-- Nettoyer les anciens comptes
DELETE FROM users
WHERE
    email IN (
        'admin@test.com',
        'magasin@test.com',
        'chauffeur@test.com'
    );

-- Récupérer un magasin existant pour le compte test
SELECT
    id
FROM
    magasins
LIMIT
    1;

-- Utiliser cet ID ci-dessous
-- Recréer les comptes proprement
INSERT INTO
    users (
        id,
        email,
        password,
        nom,
        prenom,
        role,
        magasinId,
        status,
        "createdAt",
        "updatedAt"
    )
VALUES
    (
        gen_random_uuid (),
        'admin@test.com',
        '$2b$12$hash_admin123',
        'Admin',
        'Test',
        'ADMIN',
        NULL,
        'Actif',
        NOW (),
        NOW ()
    ),
    (
        gen_random_uuid (),
        'magasin@test.com',
        '$2b$12$hash_magasin123',
        'Magasin',
        'Test',
        'MAGASIN',
        'ID_MAGASIN_ICI',
        'Actif',
        NOW (),
        NOW ()
    ),
    (
        gen_random_uuid (),
        'chauffeur@test.com',
        '$2b$12$hash_chauffeur123',
        'Chauffeur',
        'Test',
        'CHAUFFEUR',
        NULL,
        'Actif',
        NOW (),
        NOW ()
    );