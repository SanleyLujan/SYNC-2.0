import { VerificationService } from './verification.service';
import { VerificationRequest } from './verification-request.entity';

describe('verificação de identidade', () => {
  const storage = { isAvailable: jest.fn(), remove: jest.fn(), assertPrivateBucket: jest.fn(), sanitizeImage: jest.fn(), upload: jest.fn(), signedUrl: jest.fn() };
  const query: any = { addSelect: jest.fn(), where: jest.fn(), setLock: jest.fn(), getOne: jest.fn(), leftJoinAndSelect: jest.fn(), orderBy: jest.fn(), take: jest.fn(), getMany: jest.fn() };
  const requests: any = { findOne: jest.fn(), update: jest.fn(), create: jest.fn(x => x), save: jest.fn(), createQueryBuilder: () => query, manager: {} };
  const users: any = { findOne: jest.fn(), update: jest.fn() };
  let service: VerificationService;
  beforeEach(() => {
    jest.clearAllMocks();
    query.addSelect.mockReturnValue(query); query.where.mockReturnValue(query); query.setLock.mockReturnValue(query);
    for (const method of ['leftJoinAndSelect', 'orderBy', 'take']) query[method].mockReturnValue(query);
    requests.findOne.mockResolvedValue(null);
    storage.assertPrivateBucket.mockResolvedValue(undefined);
    storage.sanitizeImage.mockResolvedValue(Buffer.from('sanitized-test-image'));
    storage.upload.mockReset().mockResolvedValue(undefined);
    storage.signedUrl.mockReset().mockResolvedValue('https://example.invalid/signed-test-image');
    requests.manager.transaction = jest.fn(fn => fn({ connection: { options: { type: 'postgres' } }, getRepository: (entity: any) => entity === VerificationRequest ? requests : users }));
    service = new VerificationService(requests, users, storage as any);
    storage.remove.mockResolvedValue(undefined);
    users.findOne.mockResolvedValue({ id: 'user', isActive: true, isVerified: false });
  });
  it('não autoriza envio sem confirmar infraestrutura privada', async () => {
    users.findOne.mockResolvedValue({ isVerified: false }); requests.findOne.mockResolvedValue(null);
    storage.isAvailable.mockResolvedValue(false);
    expect((await service.status('user')).canSubmit).toBe(false);
    storage.isAvailable.mockResolvedValue(true);
    expect((await service.status('user')).canSubmit).toBe(true);
  });
  it('usa lock e não sobrescreve um pedido já analisado', async () => {
    query.getOne.mockResolvedValue({ status: 'approved' });
    await expect(service.review('id','admin','reject','motivo')).rejects.toThrow('já analisado');
    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(storage.remove).not.toHaveBeenCalled(); expect(users.update).not.toHaveBeenCalled();
  });
  it('preserva chaves e selo se a remoção dos documentos falhar', async () => {
    query.getOne.mockResolvedValue({ id:'id',user_id:'user',status:'pending',selfieKey:'a',documentFrontKey:'b',documentBackKey:'c' });
    storage.remove.mockRejectedValue(new Error('storage'));
    await expect(service.review('id','admin','approve')).rejects.toThrow('storage');
    expect(requests.update).not.toHaveBeenCalled(); expect(users.update).not.toHaveBeenCalled();
  });
  it('aprova o selo e remove as chaves privadas após a análise', async () => {
    query.getOne.mockResolvedValue({ id:'id', user_id:'user', status:'pending', selfieKey:'a', documentFrontKey:'b', documentBackKey:'c' });
    expect(await service.review('id', 'admin', 'approve')).toEqual({ ok: true, status: 'approved' });
    expect(storage.remove).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(users.update).toHaveBeenCalledWith('user', { isVerified: true });
    expect(requests.update).toHaveBeenCalledWith('id', expect.objectContaining({ status:'approved', reviewed_by:'admin', selfieKey:null, documentFrontKey:null, documentBackKey:null }));
  });
  it('recusa com motivo e permite reenvio', async () => {
    query.getOne.mockResolvedValue({ id:'id', user_id:'user', status:'pending', selfieKey:'a', documentFrontKey:'b', documentBackKey:'c' });
    await service.review('id', 'admin', 'reject', 'Frente ilegível');
    expect(users.update).toHaveBeenCalledWith('user', { isVerified: false });
    requests.findOne.mockResolvedValue({ status:'rejected', rejectionReason:'Frente ilegível' });
    storage.isAvailable.mockResolvedValue(true);
    expect(await service.status('user')).toEqual(expect.objectContaining({ canSubmit:true, rejectionReason:'Frente ilegível' }));
  });
  it('não permite autoaprovação administrativa', async () => {
    query.getOne.mockResolvedValue({ user_id:'admin', status:'pending' });
    await expect(service.review('id', 'admin', 'approve')).rejects.toThrow('Outro administrador');
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it('não permite aprovar contas desativadas', async () => {
    query.getOne.mockResolvedValue({ user_id:'user', status:'pending' });
    users.findOne.mockResolvedValue({ isActive:false });
    await expect(service.review('id', 'admin', 'approve')).rejects.toThrow('desativada');
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it('não permite aprovar imagens incompletas ou recusar sem motivo', async () => {
    query.getOne.mockResolvedValue({ user_id:'user', status:'pending', selfieKey:'a' });
    await expect(service.review('id', 'admin', 'approve')).rejects.toThrow('três imagens');
    await expect(service.review('id', 'admin', 'reject', ' ')).rejects.toThrow('motivo');
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it('retorna o selo aprovado sem permitir novo envio', async () => {
    users.findOne.mockResolvedValue({ isVerified:true }); requests.findOne.mockResolvedValue({ status:'approved' });
    expect(await service.status('user')).toEqual(expect.objectContaining({ canSubmit:false, isVerified:true, status:'approved' }));
    expect(storage.isAvailable).not.toHaveBeenCalled();
  });
  it('envia as três imagens sanitizadas e cria pedido pendente sem conceder selo', async () => {
    const files: any = { selfie:[{}], documentFront:[{}], documentBack:[{}] };
    expect(await service.submit('user', files)).toEqual({ ok:true, status:'pending' });
    expect(storage.assertPrivateBucket).toHaveBeenCalled();
    expect(storage.sanitizeImage).toHaveBeenCalledTimes(3);
    expect(storage.upload).toHaveBeenCalledTimes(3);
    expect(requests.save).toHaveBeenCalledWith(expect.objectContaining({ user_id:'user', status:'pending' }));
    expect(users.update).not.toHaveBeenCalled();
  });
  it('limpa uploads parciais quando o envio falha', async () => {
    storage.upload.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('upload failed'));
    await expect(service.submit('user', { selfie:[{}], documentFront:[{}], documentBack:[{}] } as any)).rejects.toThrow('upload failed');
    expect(storage.remove).toHaveBeenCalledWith([expect.stringContaining('/selfie.jpg')]);
    expect(requests.save).not.toHaveBeenCalled();
  });
  it('bloqueia envio incompleto, duplicado e com armazenamento indisponível', async () => {
    await expect(service.submit('user', {})).rejects.toThrow('frente e verso');
    requests.findOne.mockResolvedValueOnce({ status:'pending' });
    await expect(service.submit('user', {})).rejects.toThrow('em análise');
    storage.assertPrivateBucket.mockRejectedValueOnce(new Error('private storage'));
    await expect(service.submit('user', { selfie:[{}], documentFront:[{}], documentBack:[{}] } as any)).rejects.toThrow('private storage');
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('mantém pedido visível quando uma imagem não pode ser aberta', async () => {
    storage.isAvailable.mockResolvedValue(true);
    query.getMany.mockResolvedValue([{ id:'id', user_id:'user', user:{ id:'user', name:'Teste' }, selfieKey:'a', documentFrontKey:'b', documentBackKey:'c' }]);
    storage.signedUrl.mockRejectedValueOnce(new Error('unavailable'));
    const rows = await service.listPending();
    expect(rows).toHaveLength(1);
    expect(rows[0].imageError).toBeTruthy();
    expect(rows[0].images).toBeNull();
  });
  it('não assina imagens se o bucket deixou de ser privado', async () => {
    storage.isAvailable.mockResolvedValue(false);
    query.getMany.mockResolvedValue([{ id:'id', user_id:'user', user:{ id:'user', name:'Teste' }, selfieKey:'a', documentFrontKey:'b', documentBackKey:'c' }]);
    expect((await service.listPending())[0].imageError).toBeTruthy();
    expect(storage.signedUrl).not.toHaveBeenCalled();
  });
});
