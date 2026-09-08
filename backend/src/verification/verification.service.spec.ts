import { VerificationService } from './verification.service';
import { VerificationRequest } from './verification-request.entity';

describe('verificação de identidade', () => {
  const storage = { isAvailable: jest.fn(), remove: jest.fn() };
  const query: any = { addSelect: jest.fn(), where: jest.fn(), setLock: jest.fn(), getOne: jest.fn() };
  const requests: any = { findOne: jest.fn(), update: jest.fn(), createQueryBuilder: () => query, manager: {} };
  const users: any = { findOne: jest.fn(), update: jest.fn() };
  let service: VerificationService;
  beforeEach(() => {
    jest.clearAllMocks();
    query.addSelect.mockReturnValue(query); query.where.mockReturnValue(query); query.setLock.mockReturnValue(query);
    requests.manager.transaction = jest.fn(fn => fn({ connection: { options: { type: 'postgres' } }, getRepository: (entity: any) => entity === VerificationRequest ? requests : users }));
    service = new VerificationService(requests, users, storage as any);
    storage.remove.mockResolvedValue(undefined);
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
});
