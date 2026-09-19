param(
  [string]$ProjectRef = 'sehuynlvfvgfhelqpbrx'
)

$tokenSecure = Read-Host 'Token privado entregado por BotFather' -AsSecureString
$token = [System.Net.NetworkCredential]::new('', $tokenSecure).Password

if ([string]::IsNullOrWhiteSpace($token)) {
  throw 'El token del bot es obligatorio.'
}

try {
  Write-Host 'Comprobando el bot con Telegram...'
  $botInfo = Invoke-RestMethod -Method Get -Uri "https://api.telegram.org/bot$token/getMe"
  if (-not $botInfo.ok -or [string]::IsNullOrWhiteSpace($botInfo.result.username)) {
    throw 'Telegram no pudo identificar el bot.'
  }

  $botUsername = [string]$botInfo.result.username
  # Compatible con Windows PowerShell 5.1 y PowerShell moderno.
  $secretBytes = New-Object byte[] 32
  $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $random.GetBytes($secretBytes)
  $secret = ([BitConverter]::ToString($secretBytes) -replace '-', '').ToLowerInvariant()

  Write-Host 'Guardando secretos en Supabase...'
  & npx --yes supabase@latest secrets set `
    "TELEGRAM_BOT_TOKEN=$token" `
    "TELEGRAM_BOT_USERNAME=$botUsername" `
    "TELEGRAM_WEBHOOK_SECRET=$secret" `
    --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) {
    throw 'Supabase no pudo guardar los secretos de Telegram.'
  }

  $webhookUrl = "https://$ProjectRef.supabase.co/functions/v1/telegram-vitalwatch-bot"
  $body = @{
    url = $webhookUrl
    secret_token = $secret
    allowed_updates = @('message')
    drop_pending_updates = $true
  } | ConvertTo-Json

  Write-Host 'Configurando el webhook de Telegram...'
  $result = Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.telegram.org/bot$token/setWebhook" `
    -ContentType 'application/json' `
    -Body $body
  if (-not $result.ok) { throw 'Telegram no acepto el webhook.' }

  $webhookInfo = Invoke-RestMethod -Method Get -Uri "https://api.telegram.org/bot$token/getWebhookInfo"
  if (-not $webhookInfo.ok -or $webhookInfo.result.url -ne $webhookUrl) {
    throw 'El webhook no quedo confirmado por Telegram.'
  }

  Write-Host ''
  Write-Host "Bot confirmado: @$botUsername" -ForegroundColor Green
  Write-Host "Webhook confirmado: $webhookUrl" -ForegroundColor Green
  Write-Host 'Configuracion de Telegram terminada.' -ForegroundColor Green
} finally {
  if ($null -ne $random) { $random.Dispose() }
  $token = $null
  $secret = $null
  $secretBytes = $null
}
