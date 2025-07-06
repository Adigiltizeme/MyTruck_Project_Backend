SELECT 
    table_name,
    table_type,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Vérifier les contraintes de clés étrangères
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- 3. Vérifier l'intégrité des données existantes
-- Magasins sans airtable_id (problématique pour le mapping)
SELECT COUNT(*) as magasins_sans_airtable_id
FROM magasins 
WHERE airtable_id IS NULL;

-- Clients sans airtable_id  
SELECT COUNT(*) as clients_sans_airtable_id
FROM clients 
WHERE airtable_id IS NULL;

-- Commandes existantes et leurs relations
SELECT 
    c.id,
    c.numero,
    c.magasin_id,
    m.nom as magasin_nom,
    c.client_id,
    cl.nom as client_nom,
    c.statut_commande,
    c.statut_livraison
FROM commandes c
LEFT JOIN magasins m ON c.magasin_id = m.id
LEFT JOIN clients cl ON c.client_id = cl.id;

-- 4. Identifier les données orphelines potentielles
-- Commandes avec magasin_id invalide
SELECT COUNT(*) as commandes_magasin_invalide
FROM commandes c
LEFT JOIN magasins m ON c.magasin_id = m.id
WHERE m.id IS NULL;

-- Commandes avec client_id invalide
SELECT COUNT(*) as commandes_client_invalide  
FROM commandes c
LEFT JOIN clients cl ON c.client_id = cl.id
WHERE cl.id IS NULL;

-- 5. Statistiques générales
SELECT 
    'magasins' as table_name, COUNT(*) as count FROM magasins
UNION ALL
SELECT 'clients', COUNT(*) FROM clients  
UNION ALL
SELECT 'commandes', COUNT(*) FROM commandes
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL  
SELECT 'chauffeurs', COUNT(*) FROM chauffeurs;

-- 6. Vérifier les index pour performance
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;