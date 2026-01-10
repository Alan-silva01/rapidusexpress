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
        const { record, type, table } = await req.json()
        console.log("LOG: Payload received", { type, table, record })

        if ((type === 'INSERT' && (table === 'entregas' || table === 'clientes')) || type === 'REJECT') {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

            const adminResponse = await fetch(`${supabaseUrl}/rest/v1/perfis?funcao=eq.admin&select=id`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            })
            const admins = await adminResponse.json()
            const adminIds = admins.map((a: any) => a.id)

            // TITLE & BODY
            let title = "RAPIDUS - NOVA ENTREGA 🚀"
            let body = ""

            if (type === 'INSERT') {
                const val = parseFloat(record.valor_total || record.valor_frete || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                const rawObs = record.observacao || ""

                let estabName = "Uma loja"
                if (rawObs.startsWith("Loja: ")) {
                    const parts = rawObs.split(" - ")
                    estabName = parts[0].replace("Loja: ", "")
                }
                body = `${estabName} solicitou uma entrega\nValor: ${val}`
            } else if (type === 'REJECT') {
                title = "RAPIDUS - ENTREGA RECUSADA ❌"
                body = `Entregador ${record.driver_name} recusou a entrega`
            }

            // CLICK URL
            const clickUrl = "https://rapidusexpress.vercel.app/?view=inbox"

            // Dispatch OneSignal Notification
            const onesignalAppId = Deno.env.get("ONESIGNAL_APP_ID") || "43084836-6231-48b3-ad89-8dd3cd984b91"
            const onesignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY")

            if (onesignalApiKey && adminIds.length > 0) {
                const osResponse = await fetch("https://onesignal.com/api/v1/notifications", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Basic ${onesignalApiKey}`
                    },
                    body: JSON.stringify({
                        app_id: onesignalAppId,
                        include_external_user_ids: adminIds,
                        headings: { en: title, pt: title },
                        contents: { en: body, pt: body },
                        web_url: clickUrl
                    })
                })
                const osResult = await osResponse.json()
                console.log("LOG: OneSignal Result", osResult)
            } else {
                console.error("Missing OneSignal Key or Admins:", { hasKey: !!onesignalApiKey, adminCount: adminIds.length })
            }

            return new Response(JSON.stringify({ message: "Processed" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ message: "Ignored" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
