CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.increment_etag() RETURNS TRIGGER AS $$
BEGIN
    NEW.etag_version = OLD.etag_version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.raise_on_delete() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Deletion of % is prohibited', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.raise_on_update() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Update of % is prohibited', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Apply set_updated_at
CREATE TRIGGER admin_users_updated_at BEFORE UPDATE ON admin.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER admin_languages_updated_at BEFORE UPDATE ON admin.languages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER admin_sysconfig_updated_at BEFORE UPDATE ON admin.system_configuration FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER registry_pages_updated_at BEFORE UPDATE ON registry.pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER registry_tags_updated_at BEFORE UPDATE ON registry.tags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER content_ec_updated_at BEFORE UPDATE ON content.english_copies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER translation_tr_updated_at BEFORE UPDATE ON translation.translations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER publishing_par_updated_at BEFORE UPDATE ON publishing.publishing_approval_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER publishing_rel_updated_at BEFORE UPDATE ON publishing.releases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER collab_comments_updated_at BEFORE UPDATE ON collaboration.comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER collab_export_updated_at BEFORE UPDATE ON collaboration.export_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sysops_notif_updated_at BEFORE UPDATE ON system_ops.notifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER reporting_cov_updated_at BEFORE UPDATE ON reporting.coverage_metrics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER migration_imp_updated_at BEFORE UPDATE ON migration.import_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Apply increment_etag
CREATE TRIGGER admin_sysconfig_etag BEFORE UPDATE ON admin.system_configuration FOR EACH ROW EXECUTE FUNCTION public.increment_etag();
CREATE TRIGGER registry_pages_etag BEFORE UPDATE ON registry.pages FOR EACH ROW EXECUTE FUNCTION public.increment_etag();
CREATE TRIGGER registry_tags_etag BEFORE UPDATE ON registry.tags FOR EACH ROW EXECUTE FUNCTION public.increment_etag();
CREATE TRIGGER content_ec_etag BEFORE UPDATE ON content.english_copies FOR EACH ROW EXECUTE FUNCTION public.increment_etag();
CREATE TRIGGER translation_tr_etag BEFORE UPDATE ON translation.translations FOR EACH ROW EXECUTE FUNCTION public.increment_etag();
CREATE TRIGGER publishing_par_etag BEFORE UPDATE ON publishing.publishing_approval_requests FOR EACH ROW EXECUTE FUNCTION public.increment_etag();
CREATE TRIGGER migration_imp_etag BEFORE UPDATE ON migration.import_events FOR EACH ROW EXECUTE FUNCTION public.increment_etag();

-- Apply raise_on_update
CREATE TRIGGER audit_records_no_update BEFORE UPDATE ON system_ops.audit_records FOR EACH ROW EXECUTE FUNCTION public.raise_on_update();
CREATE TRIGGER migration_row_events_no_update BEFORE UPDATE ON migration.migration_row_events FOR EACH ROW EXECUTE FUNCTION public.raise_on_update();
CREATE TRIGGER release_snapshots_no_update BEFORE UPDATE ON publishing.release_content_snapshots FOR EACH ROW EXECUTE FUNCTION public.raise_on_update();

-- Apply raise_on_delete
CREATE TRIGGER audit_records_no_delete BEFORE DELETE ON system_ops.audit_records FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
CREATE TRIGGER import_events_no_delete BEFORE DELETE ON migration.import_events FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
CREATE TRIGGER migration_row_events_no_delete BEFORE DELETE ON migration.migration_row_events FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
CREATE TRIGGER releases_no_delete BEFORE DELETE ON publishing.releases FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
CREATE TRIGGER release_snapshots_no_delete BEFORE DELETE ON publishing.release_content_snapshots FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
CREATE TRIGGER english_copy_versions_no_delete BEFORE DELETE ON content.english_copy_versions FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
CREATE TRIGGER translation_versions_no_delete BEFORE DELETE ON translation.translation_versions FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
CREATE TRIGGER par_no_delete BEFORE DELETE ON publishing.publishing_approval_requests FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
