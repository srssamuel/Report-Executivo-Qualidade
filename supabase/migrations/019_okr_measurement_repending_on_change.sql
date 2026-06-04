-- Migration 019: Re-pendência automática de homologação ao alterar um lançamento
--
-- REGRA DE NEGÓCIO (decidida com o Samuel): o valor lançado pelo gerente JÁ CONTA no resultado
-- imediatamente (audited nunca foi portão — é selo de governança). Mas todo lançamento novo OU
-- alterado deve voltar a "pendente de homologação", sem bloquear o gerente. A superintendência
-- homologa numa fila dedicada.
--
-- Implementação autoritativa no trigger: para quem NÃO é admin/superintendente, os campos de
-- auditoria nunca podem ser tocados diretamente (anti-adulteração) E qualquer mudança no conteúdo
-- do lançamento (resultado, evidência ou ação) zera a homologação -> volta para a fila.
-- admin/superintendente mantêm controle total (homologam/ajustam pela fila).

CREATE OR REPLACE FUNCTION protect_okr_audit_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Lançamento novo de não-privilegiado nasce sempre pendente de homologação
    IF my_role() NOT IN ('admin','superintendente') THEN
      NEW.audited       := FALSE;
      NEW.audited_by    := NULL;
      NEW.audit_feedback := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF my_role() NOT IN ('admin','superintendente') THEN
    -- 1. Não-privilegiado nunca altera os campos de auditoria diretamente (pin no valor antigo)
    NEW.audited       := OLD.audited;
    NEW.audited_by    := OLD.audited_by;
    NEW.audit_feedback := OLD.audit_feedback;
    -- 2. Se o conteúdo do lançamento mudou, re-pendência automática (volta para a fila)
    IF (NEW.resultado_apurado    IS DISTINCT FROM OLD.resultado_apurado
        OR NEW.evidencia_comentario IS DISTINCT FROM OLD.evidencia_comentario
        OR NEW.acao_sugerida        IS DISTINCT FROM OLD.acao_sugerida) THEN
      NEW.audited       := FALSE;
      NEW.audited_by    := NULL;
      NEW.audit_feedback := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger já existe (BEFORE INSERT OR UPDATE, migration 015); CREATE OR REPLACE acima basta.
-- Re-afirma o hardening (REVOKE EXECUTE) após o replace, conforme migrations 011/015.
REVOKE EXECUTE ON FUNCTION protect_okr_audit_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION protect_okr_audit_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION protect_okr_audit_fields() FROM authenticated;
