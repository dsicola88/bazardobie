-- Migration: Ativar facetEnabled em atributos de categoria para filtros dinâmicos
-- Objetivo: Habilitar filtros laterais nas páginas de categoria (estilo AliExpress)
-- Reversível: Sim (down migration restaura estado original exato)

-- Passo 1: Criar coluna temporária para backup do estado original
ALTER TABLE "CategoryAttribute" ADD COLUMN "facetEnabled_backup" BOOLEAN;

-- Passo 2: Salvar estado atual antes de modificar
UPDATE "CategoryAttribute" SET "facetEnabled_backup" = "facetEnabled";

-- Passo 3: Ativar facetEnabled em atributos principais comuns (marcas, modelos, cores, etc.)
UPDATE "CategoryAttribute" 
SET "facetEnabled" = true 
WHERE key IN (
  'marca',
  'modelo',
  'cor',
  'ram',
  'armazenamento',
  'sistema_operativo',
  'ecra_polegadas',
  'diagonal_polegadas',
  'resolucao',
  'tipo_equipamento',
  'tipo_artigo',
  'tecnologia',
  'conectividade_celular',
  'rede_5g',
  'smart_tv',
  'bateria_mah',
  'wifi',
  'hdr',
  'compatibilidade',
  'processador'
);

-- Passo 4: Ativa facetEnabled para todos os atributos SELECT (dropdowns)
-- Estes são ideais para filtros de múltipla seleção
UPDATE "CategoryAttribute" 
SET "facetEnabled" = true 
WHERE "inputType" = 'SELECT' AND "facetEnabled" = false;

-- Passo 5: Ativa facetEnabled para atributos NUMBER com unitCode (medidas)
-- Estes são bons para filtros de range (min/max)
UPDATE "CategoryAttribute" 
SET "facetEnabled" = true 
WHERE "inputType" = 'NUMBER' 
  AND "unitCode" IS NOT NULL 
  AND "facetEnabled" = false;
