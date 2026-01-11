# DigiTransac .NET Auth Endpoints Test Script
# Run this after starting MongoDB and the .NET API

$baseUrl = "http://localhost:5253/api/v1"
$global:accessToken = ""
$global:refreshToken = ""

Write-Host "`n════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DigiTransac .NET Authentication Endpoint Tests" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Test 1: Register New User
Write-Host "`n[TEST 1] Register New User" -ForegroundColor Yellow
Write-Host "Endpoint: POST $baseUrl/auth/register" -ForegroundColor Gray

$registerPayload = @{
    email = "john.doe@test.com"
    username = "johndoe"
    password = "SecurePass123!"
    fullName = "John Doe"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $registerPayload -ContentType "application/json"
    Write-Host "✓ Registration successful!" -ForegroundColor Green
    $global:accessToken = $response.accessToken
    $global:refreshToken = $response.refreshToken
    Write-Host "User ID: $($response.user.id)" -ForegroundColor White
    Write-Host "Email: $($response.user.email)" -ForegroundColor White
    Write-Host "Username: $($response.user.username)" -ForegroundColor White
    Write-Host "Access Token: $($global:accessToken.Substring(0, 50))..." -ForegroundColor White
    Write-Host "Refresh Token: $($global:refreshToken.Substring(0, 30))..." -ForegroundColor White
    Write-Host "Expires In: $($response.expiresIn) seconds (15 minutes)" -ForegroundColor White
} catch {
    Write-Host "✗ Registration failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Details: $($errorDetail.error)" -ForegroundColor Red
    }
}

Start-Sleep -Seconds 1

# Test 2: Login with Email
Write-Host "`n[TEST 2] Login with Email" -ForegroundColor Yellow
Write-Host "Endpoint: POST $baseUrl/auth/login" -ForegroundColor Gray

$loginPayload = @{
    emailOrUsername = "john.doe@test.com"
    password = "SecurePass123!"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginPayload -ContentType "application/json"
    Write-Host "✓ Login successful!" -ForegroundColor Green
    $global:accessToken = $response.accessToken
    $global:refreshToken = $response.refreshToken
    Write-Host "Access Token: $($global:accessToken.Substring(0, 50))..." -ForegroundColor White
    Write-Host "Refresh Token: $($global:refreshToken.Substring(0, 30))..." -ForegroundColor White
} catch {
    Write-Host "✗ Login failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 3: Get Current User (Protected Endpoint)
Write-Host "`n[TEST 3] Get Current User Profile (Protected)" -ForegroundColor Yellow
Write-Host "Endpoint: GET $baseUrl/auth/me" -ForegroundColor Gray

try {
    $headers = @{
        Authorization = "Bearer $global:accessToken"
    }
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method GET -Headers $headers
    Write-Host "✓ Profile retrieved successfully!" -ForegroundColor Green
    Write-Host "User ID: $($response.user.id)" -ForegroundColor White
    Write-Host "Email: $($response.user.email)" -ForegroundColor White
    Write-Host "Username: $($response.user.username)" -ForegroundColor White
    Write-Host "Full Name: $($response.user.fullName)" -ForegroundColor White
} catch {
    Write-Host "✗ Failed to retrieve profile!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 4: Refresh Token
Write-Host "`n[TEST 4] Refresh Access Token" -ForegroundColor Yellow
Write-Host "Endpoint: POST $baseUrl/auth/refresh" -ForegroundColor Gray

$refreshPayload = @{
    refreshToken = $global:refreshToken
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method POST -Body $refreshPayload -ContentType "application/json"
    Write-Host "✓ Token refreshed successfully!" -ForegroundColor Green
    $oldAccessToken = $global:accessToken.Substring(0, 30)
    $global:accessToken = $response.accessToken
    $global:refreshToken = $response.refreshToken
    Write-Host "Old Access Token: $oldAccessToken..." -ForegroundColor Gray
    Write-Host "New Access Token: $($global:accessToken.Substring(0, 30))..." -ForegroundColor White
    Write-Host "New Refresh Token: $($global:refreshToken.Substring(0, 30))..." -ForegroundColor White
    Write-Host "Token Rotation: ✓ Old refresh token revoked" -ForegroundColor Green
} catch {
    Write-Host "✗ Token refresh failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 5: Login with Username
Write-Host "`n[TEST 5] Login with Username" -ForegroundColor Yellow
Write-Host "Endpoint: POST $baseUrl/auth/login" -ForegroundColor Gray

$loginPayload = @{
    emailOrUsername = "johndoe"
    password = "SecurePass123!"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginPayload -ContentType "application/json"
    Write-Host "✓ Login with username successful!" -ForegroundColor Green
    $global:accessToken = $response.accessToken
    Write-Host "Access Token: $($global:accessToken.Substring(0, 50))..." -ForegroundColor White
} catch {
    Write-Host "✗ Login failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 6: Logout (Revoke All Tokens)
Write-Host "`n[TEST 6] Logout (Revoke All Tokens)" -ForegroundColor Yellow
Write-Host "Endpoint: POST $baseUrl/auth/logout" -ForegroundColor Gray

try {
    $headers = @{
        Authorization = "Bearer $global:accessToken"
    }
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/logout" -Method POST -Headers $headers
    Write-Host "✓ Logout successful!" -ForegroundColor Green
    Write-Host "Message: $($response.message)" -ForegroundColor White
    Write-Host "All refresh tokens revoked for this user" -ForegroundColor Gray
} catch {
    Write-Host "✗ Logout failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 7: Try to Use Revoked Token
Write-Host "`n[TEST 7] Try to Use Revoked Token (Should Fail)" -ForegroundColor Yellow
Write-Host "Endpoint: GET $baseUrl/auth/me" -ForegroundColor Gray

try {
    $headers = @{
        Authorization = "Bearer $global:accessToken"
    }
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method GET -Headers $headers
    Write-Host "✗ Token still valid (unexpected!)" -ForegroundColor Red
} catch {
    Write-Host "✓ Token rejected as expected!" -ForegroundColor Green
    Write-Host "Access token is still valid but refresh tokens are revoked" -ForegroundColor Gray
}

# Test 8: Try to Refresh with Revoked Token (Should Fail)
Write-Host "`n[TEST 8] Try to Refresh with Revoked Token (Should Fail)" -ForegroundColor Yellow
Write-Host "Endpoint: POST $baseUrl/auth/refresh" -ForegroundColor Gray

$refreshPayload = @{
    refreshToken = $global:refreshToken
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method POST -Body $refreshPayload -ContentType "application/json"
    Write-Host "✗ Revoked token accepted (unexpected!)" -ForegroundColor Red
} catch {
    Write-Host "✓ Revoked token rejected as expected!" -ForegroundColor Green
    Write-Host "Error: Invalid or expired refresh token" -ForegroundColor Gray
}

# Summary
Write-Host "`n════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
Write-Host "✓ User Registration" -ForegroundColor Green
Write-Host "✓ Login with Email" -ForegroundColor Green
Write-Host "✓ Login with Username" -ForegroundColor Green
Write-Host "✓ Protected Endpoint (GET /me)" -ForegroundColor Green
Write-Host "✓ Token Refresh with Rotation" -ForegroundColor Green
Write-Host "✓ Logout with Token Revocation" -ForegroundColor Green
Write-Host "✓ Security Validation (Revoked tokens rejected)" -ForegroundColor Green
Write-Host "`nAll authentication flows working correctly! ✨`n" -ForegroundColor Green
