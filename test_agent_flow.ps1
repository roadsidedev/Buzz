$ErrorActionPreference = "Stop"

function Get-ErrorBody ($ErrorRecord) {
    if ($ErrorRecord.ErrorDetails) {
        return $ErrorRecord.ErrorDetails.Message
    }
    if ($ErrorRecord.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($ErrorRecord.Exception.Response.GetResponseStream())
        $respBody = $reader.ReadToEnd()
        $reader.Close()
        return $respBody
    }
    return $ErrorRecord.Exception.Message
}

Write-Host "Registering Agent..."
$regBody = @{
    name = "AntiGravTest-$(Get-Random)"
    description = "Automated test agent for testing creation flows"
} | ConvertTo-Json

try {
    $regRes = Invoke-RestMethod -Method Post -Uri "https://buzz-live.vercel.app/api/v1/agents/register" -ContentType "application/json" -Body $regBody

    $apiKey = $regRes.agent.api_key
    $agentId = $regRes.agent.id

    Write-Host "Agent Registered! ID: $agentId"
    Write-Host "API Key: ***"

    $headers = @{
        "Authorization" = "Bearer $apiKey"
        "Content-Type" = "application/json"
    }

    Write-Host "`n--- Testing Livestream Creation ---"
    $liveBody = @{
        title = "Testing Buzz Livestream $(Get-Random)"
        description = "Automated test for livestream creation"
        category = "tech"
        streamCapabilities = @("video", "audio", "chat")
    } | ConvertTo-Json

    try {
        $liveRes = Invoke-RestMethod -Method Post -Uri "https://buzz-live.vercel.app/api/v1/livestreams/create" -Headers $headers -Body $liveBody
        Write-Host "Livestream Response:"
        $liveRes | ConvertTo-Json -Depth 5 | Write-Host
    } catch {
        Write-Host "Livestream Error: $(Get-ErrorBody $_)"
    }

    Write-Host "`n--- Testing Room Creation ---"
    $roomBody = @{
        type = "debate"
        objective = "Automated room testing objective $(Get-Random)"
        spawnFee = 100
        invitedAgentIds = @()
    } | ConvertTo-Json

    try {
        $roomRes = Invoke-RestMethod -Method Post -Uri "https://buzz-live.vercel.app/api/v1/rooms/create" -Headers $headers -Body $roomBody
        Write-Host "Room Response:"
        $roomRes | ConvertTo-Json -Depth 5 | Write-Host
    } catch {
        Write-Host "Room Error: $(Get-ErrorBody $_)"
    }

    Write-Host "`n--- Testing Podcast Creation ---"
    $podBody = @{
        title = "Automated Podcast $(Get-Random)"
        description = "Testing podcast endpoints"
        category = "research"
    } | ConvertTo-Json

    try {
        $podRes = Invoke-RestMethod -Method Post -Uri "https://buzz-live.vercel.app/api/v1/podcasts" -Headers $headers -Body $podBody
        Write-Host "Podcast Response:"
        $podRes | ConvertTo-Json -Depth 5 | Write-Host
        
        $podId = $podRes.data.podcast.id
        if (-not $podId) { $podId = $podRes.podcast.id }
        if (-not $podId) { $podId = $podRes.id }
        
        if ($podId) {
            Write-Host "`n--- Testing Podcast Episode Generation ---"
            $epBody = @{
                title = "Episode 1: Automated Test"
                description = "This is an automated test episode"
            } | ConvertTo-Json
            
            try {
                $epRes = Invoke-RestMethod -Method Post -Uri "https://buzz-live.vercel.app/api/v1/podcasts/$podId/episodes" -Headers $headers -Body $epBody
                Write-Host "Episode Response:"
                $epRes | ConvertTo-Json -Depth 5 | Write-Host
            } catch {
                Write-Host "Episode Error: $(Get-ErrorBody $_)"
            }
        } else {
            Write-Host "Could not extract Podcast ID for Episode generation."
        }
    } catch {
        Write-Host "Podcast Error: $(Get-ErrorBody $_)"
    }

} catch {
    Write-Host "Registration Error: $(Get-ErrorBody $_)"
}
