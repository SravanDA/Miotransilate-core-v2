package com.miotranslate.shared.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.UUID;

@Component
public class RbacInterceptor implements HandlerInterceptor {

    private final PermissionService permissionService;

    public RbacInterceptor(PermissionService permissionService) {
        this.permissionService = permissionService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        RequiresPermission annotation = handlerMethod.getMethodAnnotation(RequiresPermission.class);
        if (annotation == null) {
            annotation = AnnotationUtils.findAnnotation(handlerMethod.getBeanType(), RequiresPermission.class);
        }

        if (annotation != null) {
            try {
                UUID userId = SecurityUtils.getCurrentUserId();
                String requiredPermission = annotation.value();

                if (!permissionService.hasPermission(userId, requiredPermission)) {
                    response.sendError(HttpStatus.FORBIDDEN.value(), "MISSING_PERMISSION");
                    return false;
                }
            } catch (Exception e) {
                response.sendError(HttpStatus.UNAUTHORIZED.value(), "UNAUTHORIZED");
                return false;
            }
        }

        return true;
    }
}
