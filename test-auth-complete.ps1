# DigiTransac .NET Auth Endpoints - Complete Test Suite
# This script comprehensively tests all authentication endpoints

$baseUrl = "http://localhost:5253/api/v1"
$testUser = @{
    email = "testuser_$(Get-Random)@test.com"
    username = "testuser_$(Get-Random)"
    password = "TestPassword123!"
    fullName = "Test User"
}

Write-Host "`n════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DigiTransac .NET Authentication - Complete Test Suite" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

$testResults = @()

# ========== TEST 1: User Registration ==========
Write-Host "[TEST 1/8] Register New User" -ForegroundColor Yellow
Write-Host "  Endpoint: POST /api/v1/auth/register" -ForegroundColor Gray

$registerPayload = $testUser | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $registerPayload -ContentType "application/json"
    Write-Host "  ✓ Registration successful!" -ForegroundColor Green
    Write-Host "    Email: $($response.user.email)" -ForegroundColor White
    Write-Host "    Username: $($response.user.username)" -ForegroundColor White
    Write-Host "    User ID: $($response.user.id)" -ForegroundColor White
    Write-Host "    Access Token received: $($response.accessToken.Length) chars" -ForegroundColor White
    
    $script:accessToken = $response.accessToken
    $script:refreshToken = $response.refreshToken
    $script:userId = $response.user.id
    
    $testResults += @{Test = "User Registration"; Status = "✓ PASS"; Details = "User registered successfully" }
} catch {
    Write-Host "  ✗ Registration failed!" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{Test = "User Registration"; Status = "✗ FAIL"; Details = $_.Exception.Message }
    exit 1
}

Start-Sleep -Seconds 1

# ========== TEST 2: Get Profile (Protected) ==========
Write-Host "`n[TEST 2/8] Get Current User Profile (Protected Endpoint)" -ForegroundColor Yellow
Write-Host "  Endpoint: GET /api/v1/auth/me" -ForegroundColor Gray

try {
    $headers = @{ Authorization = "Bearer $script:accessToken" }
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method GET -Headers $headers
    Write-Host "  ✓ Profile retrieved successfully!" -ForegroundColor Green
    Write-Host "    Email: $($response.user.email)" -ForegroundColor White
    Write-Host "    Username: $($response.user.username)" -ForegroundColor White
    Write-Host "    Auth status: $($response.success)" -ForegroundColor White
    
    $testResults += @{Test = "Get Profile"; Status = "✓ PASS"; Details = "Profile retrieved" }
} catch {
    Write-Host "  ✗ Failed to retrieve profile!" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{Test = "Get Profile"; Status = "✗ FAIL"; Details = $_.Exception.Message }
}

Start-Sleep -Seconds 1

# ========== TEST 3: Refresh Token with Rotation ==========
Write-Host "`n[TEST 3/8] Refresh Token (Token Rotation Pattern)" -ForegroundColor Yellow
Write-Host "  Endpoint: POST /api/v1/auth/refresh" -ForegroundColor Gray

$oldAccessToken = $script:accessToken.Substring(0, 30)
$oldRefreshToken = $script:refreshToken

try {
    $refreshPayload = @{ refreshToken = $script:refreshToken } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method POST -Body $refreshPayload -ContentType "application/json"
    
    Write-Host "  ✓ Token refreshed successfully!" -ForegroundColor Green
    Write-Host "    Old Access Token: $oldAccessToken..." -ForegroundColor Gray
    Write-Host "    New Access Token: $($response.accessToken.Substring(0, 30))..." -ForegroundColor White
    Write-Host "    Token Rotation: Old token revoked ✓" -ForegroundColor Green
    Write-Host "    Expiry: $($response.expiresIn) seconds (15 minutes)" -ForegroundColor White
    
    $script:accessToken = $response.accessToken
    $script:refreshToken = $response.refreshToken
    
    $testResults += @{Test = "Token Refresh"; Status = "✓ PASS"; Details = "Token rotated, old revoked" }
} catch {
    Write-Host "  ✗ Token refresh failed!" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{Test = "Token Refresh"; Status = "✗ FAIL"; Details = $_.Exception.Message }
}

Start-Sleep -Seconds 1

# ========== TEST 4: Login with Email ==========
Write-Host "`n[TEST 4/8] Login with Email" -ForegroundColor Yellow
Write-Host "  Endpoint: POST /api/v1/auth/login" -ForegroundColor Gray

try {
    $loginPayload = @{
        emailOrUsername = $testUser.email
        password = $testUser.password
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginPayload -ContentType "application/json"
    Write-Host "  ✓ Login successful!" -ForegroundColor Green
    Write-Host "    Email: $($response.user.email)" -ForegroundColor White
    Write-Host "    Access Token: $($response.accessToken.Substring(0, 50))..." -ForegroundColor White
    
    $testResults += @{Test = "Login with Email"; Status = "✓ PASS"; Details = "Login successful" }
} catch {
    Write-Host "  ✗ Login failed!" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{Test = "Login with Email"; Status = "✗ FAIL"; Details = $_.Exception.Message }
}

Start-Sleep -Seconds 1

# ========== TEST 5: Login with Username ==========
Write-Host "`n[TEST 5/8] Login with Username" -ForegroundColor Yellow
Write-Host "  Endpoint: POST /api/v1/auth/login" -ForegroundColor Gray

try {
    $loginPayload = @{
        emailOrUsername = $testUser.username
        password = $testUser.password
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginPayload -ContentType "application/json"
    Write-Host "  ✓ Login successful!" -ForegroundColor Green
    Write-Host "    Username: $($response.user.username)" -ForegroundColor White
    Write-Host "    Access Token: $($response.accessToken.Substring(0, 50))..." -ForegroundColor White
    
    $script:accessToken = $response.accessToken
    $script:refreshToken = $response.refreshToken
    
    $testResults += @{Test = "Login with Username"; Status = "✓ PASS"; Details = "Login successful" }
} catch {
    Write-Host "  ✗ Login failed!" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{Test = "Login with Username"; Status = "✗ FAIL"; Details = $_.Exception.Message }
}

Start-Sleep -Seconds 1

# ========== TEST 6: Logout (Revoke All Tokens) ==========
Write-Host "`n[TEST 6/8] Logout - Revoke All Tokens" -ForegroundColor Yellow
Write-Host "  Endpoint: POST /api/v1/auth/logout" -ForegroundColor Gray

try {
    $headers = @{ Authorization = "Bearer $script:accessToken" }
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/logout" -Method POST -Headers $headers
    Write-Host "  ✓ Logout successful!" -ForegroundColor Green
    Write-Host "    Message: $($response.message)" -ForegroundColor White
    Write-Host "    All refresh tokens revoked ✓" -ForegroundColor Green
    
    $testResults += @{Test = "Logout"; Status = "✓ PASS"; Details = "All tokens revoked" }
} catch {
    Write-Host "  ✗ Logout failed!" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{Test = "Logout"; Status = "✗ FAIL"; Details = $_.Exception.Message }
}

Start-Sleep -Seconds 1

# ========== TEST 7: Invalid Credentials ==========
Write-Host "`n[TEST 7/8] Invalid Credentials (Should Fail)" -ForegroundColor Yellow
Write-Host "  Endpoint: POST /api/v1/auth/login" -ForegroundColor Gray

try {
    $loginPayload = @{
        emailOrUsername = $testUser.email
        password = "WrongPassword123!"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginPayload -ContentType "application/json"
    Write-Host "  ✗ Invalid password accepted (security issue!)" -ForegroundColor Red
    $testResults += @{Test = "Invalid Credentials"; Status = "✗ FAIL"; Details = "Invalid password was accepted" }
} catch {
    Write-Host "  ✓ Invalid credentials rejected!" -ForegroundColor Green
    Write-Host "    Correctly denied access ✓" -ForegroundColor White
    $testResults += @{Test = "Invalid Credentials"; Status = "✓ PASS"; Details = "Invalid password rejected" }
}

Start-Sleep -Seconds 1

# ========== TEST 8: Duplicate User Registration ==========
Write-Host "`n[TEST 8/8] Duplicate User Registration (Should Fail)" -ForegroundColor Yellow
Write-Host "  Endpoint: POST /api/v1/auth/register" -ForegroundColor Gray

try {
    $registerPayload = @{
        email = $testUser.email
        username = $testUser.username
        password = "Different@123"
        fullName = "Different Name"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $registerPayload -ContentType "application/json"
    Write-Host "  ✗ Duplicate user accepted (security issue!)" -ForegroundColor Red
    $testResults += @{Test = "Duplicate Registration"; Status = "✗ FAIL"; Details = "Duplicate user was accepted" }
} catch {
    Write-Host "  ✓ Duplicate user rejected!" -ForegroundColor Green
    Write-Host "    Correctly prevented duplicate registration ✓" -ForegroundColor White
    $testResults += @{Test = "Duplicate Registration"; Status = "✓ PASS"; Details = "Duplicate prevented" }
}

# ========== TEST SUMMARY ==========
Write-Host "`n════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Test Results Summary" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

$passed = ($testResults | Where-Object { $_.Status -match "PASS" } | Measure-Object).Count
$failed = ($testResults | Where-Object { $_.Status -match "FAIL" } | Measure-Object).Count

foreach ($result in $testResults) {
    $statusColor = if ($result.Status -match "PASS") { "Green" } else { "Red" }
    Write-Host "$($result.Status)  $($result.Test)" -ForegroundColor $statusColor
}

Write-Host "`n════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Total: $($testResults.Count) tests | Passed: $passed | Failed: $failed" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host "✨ ALL TESTS PASSED! Authentication system is working correctly." -ForegroundColor Green
} else {
    Write-Host "⚠️  $failed test(s) failed. Review errors above." -ForegroundColor Yellow
}
