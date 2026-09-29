-- Los potenciales existentes pasan a tipo "potencial" (verificado: ninguno tenía recorridos ni tarifas).
UPDATE "client" SET "type" = 'potencial' WHERE "status" = 'potencial';
