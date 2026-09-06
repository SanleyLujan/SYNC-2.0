-- PARTE 1 — pode ser executada agora, antes de existir qualquer administrador.
-- Execute no SQL Editor do Supabase com uma conta proprietária do projeto.

-- A migration 1782400000000 e o primeiro bootstrap do TypeORM também criam
-- esta coluna. O bloco condicional permite rodar este arquivo até mesmo antes
-- de a tabela users existir em uma instalação totalmente nova.
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "isAdmin" boolean NOT NULL DEFAULT false';
  ELSE
    RAISE NOTICE 'Tabela public.users ainda não existe; isAdmin será criada pelo bootstrap/migration do backend.';
  END IF;
END $$;

-- O bucket de KYC deve permanecer PRIVADO. O backend acessa usando service role;
-- essa chave nunca deve ser colocada no app mobile, Vercel ou repositório Git.
INSERT INTO storage.buckets (id, name, public)
VALUES ('identity-verification', 'identity-verification', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Confirma que o bucket privado está pronto. Nenhum usuário é promovido aqui.
SELECT id, public
FROM storage.buckets
WHERE id = 'identity-verification';
