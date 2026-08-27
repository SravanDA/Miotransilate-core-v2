-- Seed data with relevant MioSalon pages, tags, and translations

-- 1. Insert Registry Pages
INSERT INTO registry.pages (page_id, page_name, module, status, created_by, created_at, updated_at)
VALUES 
    ('page-calendar-01', 'Appointment Calendar', 'Calendar', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('page-pos-01', 'POS Checkout', 'POS', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('page-crm-01', 'Client Profile', 'CRM', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now())
ON CONFLICT (page_id) DO NOTHING;

-- 2. Insert Registry Tags
INSERT INTO registry.tags (tag_id, page_id, copy_type, status, created_by, created_at, updated_at)
VALUES 
    -- Calendar
    ('btn_book_appointment', 'page-calendar-01', 'BUTTON', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('lbl_staff_member', 'page-calendar-01', 'LABEL', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('msg_slot_unavailable', 'page-calendar-01', 'MESSAGE', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    -- POS
    ('lbl_total_amount', 'page-pos-01', 'LABEL', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('btn_process_payment', 'page-pos-01', 'BUTTON', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('msg_payment_success', 'page-pos-01', 'MESSAGE', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    -- CRM
    ('lbl_client_name', 'page-crm-01', 'LABEL', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('tab_service_history', 'page-crm-01', 'TAB', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('btn_add_notes', 'page-crm-01', 'BUTTON', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now())
ON CONFLICT (tag_id) DO NOTHING;

-- 3. Insert English Copies
INSERT INTO content.english_copies (tag_id, status, current_version_number, created_at, updated_at)
VALUES 
    ('btn_book_appointment', 'APPROVED', 1, now(), now()),
    ('lbl_staff_member', 'APPROVED', 1, now(), now()),
    ('msg_slot_unavailable', 'APPROVED', 1, now(), now()),
    ('lbl_total_amount', 'APPROVED', 1, now(), now()),
    ('btn_process_payment', 'APPROVED', 1, now(), now()),
    ('msg_payment_success', 'APPROVED', 1, now(), now()),
    ('lbl_client_name', 'APPROVED', 1, now(), now()),
    ('tab_service_history', 'APPROVED', 1, now(), now()),
    ('btn_add_notes', 'APPROVED', 1, now(), now())
ON CONFLICT (tag_id) DO NOTHING;

-- 4. Insert English Copy Versions
INSERT INTO content.english_copy_versions (tag_id, version_number, text, authored_by, status, created_at)
VALUES 
    ('btn_book_appointment', 1, 'Book Appointment', '11111111-1111-1111-1111-111111111111', 'APPROVED', now()),
    ('lbl_staff_member', 1, 'Staff Member', '11111111-1111-1111-1111-111111111111', 'APPROVED', now()),
    ('msg_slot_unavailable', 1, 'This time slot is no longer available.', '11111111-1111-1111-1111-111111111111', 'APPROVED', now()),
    ('lbl_total_amount', 1, 'Total Amount', '11111111-1111-1111-1111-111111111111', 'APPROVED', now()),
    ('btn_process_payment', 1, 'Process Payment', '11111111-1111-1111-1111-111111111111', 'APPROVED', now()),
    ('msg_payment_success', 1, 'Payment processed successfully!', '11111111-1111-1111-1111-111111111111', 'APPROVED', now()),
    ('lbl_client_name', 1, 'Client Name', '11111111-1111-1111-1111-111111111111', 'APPROVED', now()),
    ('tab_service_history', 1, 'Service History', '11111111-1111-1111-1111-111111111111', 'APPROVED', now()),
    ('btn_add_notes', 1, 'Add Notes', '11111111-1111-1111-1111-111111111111', 'APPROVED', now())
ON CONFLICT (tag_id, version_number) DO NOTHING;

-- 5. Insert Translations (Spanish - Fully Approved)
INSERT INTO translation.translations (tag_id, language_code, status, current_version_number, created_at, updated_at)
VALUES 
    ('btn_book_appointment', 'es', 'APPROVED', 1, now(), now()),
    ('lbl_staff_member', 'es', 'APPROVED', 1, now(), now()),
    ('msg_slot_unavailable', 'es', 'APPROVED', 1, now(), now()),
    ('lbl_total_amount', 'es', 'APPROVED', 1, now(), now()),
    ('btn_process_payment', 'es', 'APPROVED', 1, now(), now()),
    ('msg_payment_success', 'es', 'APPROVED', 1, now(), now()),
    ('lbl_client_name', 'es', 'APPROVED', 1, now(), now()),
    ('tab_service_history', 'es', 'APPROVED', 1, now(), now()),
    ('btn_add_notes', 'es', 'APPROVED', 1, now(), now())
ON CONFLICT (tag_id, language_code) DO NOTHING;

INSERT INTO translation.translation_versions (tag_id, language_code, version_number, text, creation_method, source_english_version, status, authored_by, created_at)
VALUES 
    ('btn_book_appointment', 'es', 1, 'Reservar cita', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now()),
    ('lbl_staff_member', 'es', 1, 'Miembro del personal', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now()),
    ('msg_slot_unavailable', 'es', 1, 'Este horario ya no está disponible.', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now()),
    ('lbl_total_amount', 'es', 1, 'Cantidad total', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now()),
    ('btn_process_payment', 'es', 1, 'Procesar pago', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now()),
    ('msg_payment_success', 'es', 1, '¡Pago procesado con éxito!', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now()),
    ('lbl_client_name', 'es', 1, 'Nombre del cliente', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now()),
    ('tab_service_history', 'es', 1, 'Historial de servicios', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now()),
    ('btn_add_notes', 'es', 1, 'Añadir notas', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now())
ON CONFLICT (tag_id, language_code, version_number) DO NOTHING;

-- 6. Insert Translations (French - Mixed Status)
INSERT INTO translation.translations (tag_id, language_code, status, current_version_number, created_at, updated_at)
VALUES 
    ('btn_book_appointment', 'fr', 'APPROVED', 1, now(), now()),
    ('lbl_staff_member', 'fr', 'DRAFT', 1, now(), now()),
    ('msg_slot_unavailable', 'fr', 'PENDING_REVIEW', 1, now(), now()),
    ('lbl_total_amount', 'fr', 'APPROVED', 1, now(), now()),
    ('btn_process_payment', 'fr', 'DRAFT', 1, now(), now()),
    ('msg_payment_success', 'fr', 'APPROVED', 1, now(), now())
ON CONFLICT (tag_id, language_code) DO NOTHING;

INSERT INTO translation.translation_versions (tag_id, language_code, version_number, text, creation_method, source_english_version, status, authored_by, created_at)
VALUES 
    ('btn_book_appointment', 'fr', 1, 'Prendre rendez-vous', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now()),
    ('lbl_staff_member', 'fr', 1, 'Membre du personnel', 'AI_GENERATED', 1, 'DRAFT', '11111111-1111-1111-1111-111111111111', now()),
    ('msg_slot_unavailable', 'fr', 1, 'Ce créneau n''est plus disponible.', 'AI_GENERATED', 1, 'PENDING_REVIEW', '11111111-1111-1111-1111-111111111111', now()),
    ('lbl_total_amount', 'fr', 1, 'Montant total', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now()),
    ('btn_process_payment', 'fr', 1, 'Traiter le paiement', 'AI_GENERATED', 1, 'DRAFT', '11111111-1111-1111-1111-111111111111', now()),
    ('msg_payment_success', 'fr', 1, 'Paiement traité avec succès!', 'AI_GENERATED', 1, 'APPROVED', '11111111-1111-1111-1111-111111111111', now())
ON CONFLICT (tag_id, language_code, version_number) DO NOTHING;

-- 7. Insert Translations (Arabic - All Drafts)
INSERT INTO translation.translations (tag_id, language_code, status, current_version_number, created_at, updated_at)
VALUES 
    ('btn_book_appointment', 'ar', 'DRAFT', 1, now(), now()),
    ('lbl_staff_member', 'ar', 'DRAFT', 1, now(), now()),
    ('msg_slot_unavailable', 'ar', 'DRAFT', 1, now(), now())
ON CONFLICT (tag_id, language_code) DO NOTHING;

INSERT INTO translation.translation_versions (tag_id, language_code, version_number, text, creation_method, source_english_version, status, authored_by, created_at)
VALUES 
    ('btn_book_appointment', 'ar', 1, 'حجز موعد', 'AI_GENERATED', 1, 'DRAFT', '11111111-1111-1111-1111-111111111111', now()),
    ('lbl_staff_member', 'ar', 1, 'موظف', 'AI_GENERATED', 1, 'DRAFT', '11111111-1111-1111-1111-111111111111', now()),
    ('msg_slot_unavailable', 'ar', 1, 'هذا الوقت غير متاح.', 'AI_GENERATED', 1, 'DRAFT', '11111111-1111-1111-1111-111111111111', now())
ON CONFLICT (tag_id, language_code, version_number) DO NOTHING;
