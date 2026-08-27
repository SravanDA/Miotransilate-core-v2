package com.miotranslate.modules.publishing.repository;

import com.miotranslate.modules.publishing.model.ReleaseContentSnapshot;
import com.miotranslate.modules.publishing.model.ReleaseContentSnapshotId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface ReleaseContentSnapshotRepository extends JpaRepository<ReleaseContentSnapshot, ReleaseContentSnapshotId> {
    List<ReleaseContentSnapshot> findByReleaseId(UUID releaseId);
}
