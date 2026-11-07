package com.genisource.wms.identity.web;

public record TokenResponse(String accessToken, String refreshToken, UserSummary user) {
}
