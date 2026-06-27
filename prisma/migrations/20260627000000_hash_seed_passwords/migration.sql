-- Replace legacy plaintext seed passwords with bcrypt hashes.
UPDATE "User"
SET "passwordHash" = '$2b$10$QIvh.kRC9UKij7RhtL0s4OGbDWKMghfjNehD/Mo.LByNQRQkgOBO.'
WHERE "email" = 'sindico@gcv.com.br'
  AND "passwordHash" = 'sindico123';

UPDATE "User"
SET "passwordHash" = '$2b$10$7ToazWniW9yJPnIwmzZxIeBzgN4ECGJtGBWFkasJuWAuqzkiXu.fi'
WHERE "email" = 'zelador@gcv.com.br'
  AND "passwordHash" = 'zelador123';

UPDATE "User"
SET "passwordHash" = '$2b$10$gTuIRmWoQRw2G6NcMkTHlOus0COLe9dBafvs0z03zOCoMtX5OiScm'
WHERE "passwordHash" = 'resident123';
