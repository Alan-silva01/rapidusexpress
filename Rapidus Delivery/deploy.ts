import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Keys must be set in Supabase Secrets
// ONESIGNAL_APP_ID (optional if hardcoded)
// ONESIGNAL_REST_API_KEY (REQUIRED)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload = await req.json()
        const { record, type } = payload
        console.log("LOG: Payload received", { type, record })

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        // SÓ NOTIFICA SE FOR REJECT (RECUSA)
        if (type !== 'REJECT') {
            return new Response(JSON.stringify({ message: "Ignored: Only REJECT type notifies admin here. Assignments handled by n8n." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Determine recipients: TODOS OS ADMINS
        const adminResponse = await fetch(`${supabaseUrl}/rest/v1/perfis?funcao=eq.admin&select=id`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        })
        const admins = await adminResponse.json()
        const targetIds = admins.map((a: any) => a.id)

        if (targetIds.length === 0) {
            return new Response(JSON.stringify({ message: "No admins found" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // TITLE & BODY para RECUSA
        const title = "RAPIDUS - ENTREGA RECUSADA ❌"
        const body = `o entregador ${record.driver_name} recusou a entrega atribuida a ele`
        const clickUrl = "https://rapidusexpress.vercel.app/?view=inbox"

        // Dispatch OneSignal Notification
        const onesignalAppId = Deno.env.get("ONESIGNAL_APP_ID") || "43084836-6231-48b3-ad89-8dd3cd984b91"
        const onesignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY")

        if (onesignalApiKey) {
            const osResponse = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Basic ${onesignalApiKey}`
                },
                body: JSON.stringify({
                    app_id: onesignalAppId,
                    include_external_user_ids: targetIds,
                    headings: { en: title, pt: title },
                    contents: { en: body, pt: body },
                    web_url: clickUrl
                })
            })
            const osResult = await osResponse.json()
            console.log("LOG: OneSignal Result", osResult)

            return new Response(JSON.stringify({ message: "Processed Rejection Notification", osResult }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        } else {
            console.error("Missing OneSignal Key")
            return new Response(JSON.stringify({ error: "Missing OneSignal Key" }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

    } catch (error) {
        console.error("Critical error in edge function:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
