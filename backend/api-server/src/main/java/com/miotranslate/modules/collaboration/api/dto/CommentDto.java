package com.miotranslate.modules.collaboration.api.dto;

import java.util.ArrayList;
import java.util.List;

public class CommentDto {
    private String commentId;
    private String tagId;
    private String parentCommentId;
    private ScopeDto scope;
    private AuthorDto author;
    private String text;
    private boolean resolved;
    private AuthorDto resolvedBy;
    private String resolvedAt;
    private boolean isEscalation;
    private String escalationReason;
    private String createdAt;
    private List<CommentDto> replies = new ArrayList<>();

    public String getCommentId() {
        return commentId;
    }

    public void setCommentId(String commentId) {
        this.commentId = commentId;
    }

    public String getTagId() {
        return tagId;
    }

    public void setTagId(String tagId) {
        this.tagId = tagId;
    }

    public String getParentCommentId() {
        return parentCommentId;
    }

    public void setParentCommentId(String parentCommentId) {
        this.parentCommentId = parentCommentId;
    }

    public ScopeDto getScope() {
        return scope;
    }

    public void setScope(ScopeDto scope) {
        this.scope = scope;
    }

    public AuthorDto getAuthor() {
        return author;
    }

    public void setAuthor(AuthorDto author) {
        this.author = author;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public boolean isResolved() {
        return resolved;
    }

    public void setResolved(boolean resolved) {
        this.resolved = resolved;
    }

    public AuthorDto getResolvedBy() {
        return resolvedBy;
    }

    public void setResolvedBy(AuthorDto resolvedBy) {
        this.resolvedBy = resolvedBy;
    }

    public String getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(String resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public boolean isEscalation() {
        return isEscalation;
    }

    public void setEscalation(boolean escalation) {
        isEscalation = escalation;
    }

    public String getEscalationReason() {
        return escalationReason;
    }

    public void setEscalationReason(String escalationReason) {
        this.escalationReason = escalationReason;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public List<CommentDto> getReplies() {
        return replies;
    }

    public void setReplies(List<CommentDto> replies) {
        this.replies = replies;
    }
}
