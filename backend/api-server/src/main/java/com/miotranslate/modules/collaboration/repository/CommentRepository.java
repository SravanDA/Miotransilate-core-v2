package com.miotranslate.modules.collaboration.repository;

import com.miotranslate.modules.collaboration.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CommentRepository extends JpaRepository<Comment, UUID> {
    
    List<Comment> findByTagIdOrderByCreatedAtAsc(String tagId);
    
    List<Comment> findByIsEscalationTrueAndIsResolvedFalseOrderByCreatedAtAsc();
}
