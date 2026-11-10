-- Présentation publique des mentions (fenêtre de détail sur l'accueil)
ALTER TABLE `Mention`
    ADD COLUMN `tagline` TEXT NULL,
    ADD COLUMN `imageUrl` TEXT NULL,
    ADD COLUMN `diploma` TEXT NULL,
    ADD COLUMN `studyModes` TEXT NULL,
    ADD COLUMN `objectives` TEXT NULL,
    ADD COLUMN `skills` TEXT NULL,
    ADD COLUMN `careers` TEXT NULL,
    ADD COLUMN `admission` TEXT NULL;
