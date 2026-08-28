package com.miotranslate.modules.collaboration.api.dto;

public class EscalatedItemDto {
    private CommentDto comment;
    private String tagId;
    private String pageId;
    private String pageName;
    private String englishCopy;
    private String copyType;

    public CommentDto getComment() {
        return comment;
    }

    public void setComment(CommentDto comment) {
        this.comment = comment;
    }

    public String getTagId() {
        return tagId;
    }

    public void setTagId(String tagId) {
        this.tagId = tagId;
    }

    public String getPageId() {
        return pageId;
    }

    public void setPageId(String pageId) {
        this.pageId = pageId;
    }

    public String getPageName() {
        return pageName;
    }

    public void setPageName(String pageName) {
        this.pageName = pageName;
    }

    public String getEnglishCopy() {
        return englishCopy;
    }

    public void setEnglishCopy(String englishCopy) {
        this.englishCopy = englishCopy;
    }

    public String getCopyType() {
        return copyType;
    }

    public void setCopyType(String copyType) {
        this.copyType = copyType;
    }
}
