-- PARTE 2 — execute SOMENTE depois que a conta administrativa já existir.
-- Antes de rodar, substitua o email de exemplo pelo email EXATO da conta.
-- O domínio .invalid impede uma promoção acidental se o placeholder não for trocado.

UPDATE public.users
SET "isAdmin" = true
WHERE lower(email) = lower('SUBSTITUA-PELO-EMAIL-DO-ADMIN@example.invalid');

-- A consulta deve retornar exatamente a conta que você acabou de promover.
-- Se não retornar nenhuma linha, confirme se o cadastro já existe e se o email está correto.
SELECT id, email, "isAdmin", "isVerified"
FROM public.users
WHERE "isAdmin" = true
ORDER BY email;
