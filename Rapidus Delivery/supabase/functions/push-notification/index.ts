
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import webpush from "npm:web-push@3.6.4"

// Keys must be set in Supabase Secrets
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("Missing VAPID Keys in Environment")
}

webpush.setVapidDetails(
    'mailto:alan@rapidus.delivery',
    VAPID_PUBLIC_KEY!,
    VAPID_PRIVATE_KEY!
)

serve(async (req) => {
    try {
        const { record, type, table } = await req.json()
        console.log("LOG: Payload received", { type, table, record })

        if (type === 'INSERT' && (table === 'entregas' || table === 'clientes')) {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

            const adminResponse = await fetch(`${supabaseUrl}/rest/v1/perfis?funcao=eq.admin&select=push_token`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            })
            const admins = await adminResponse.json()

            const notifications = []

            // TITLE
            const title = "RAPIDUS - NOVA ENTREGA 🚀"

            // PARSE VALUES
            // 'observacao' now contains "Loja: Drogasil - obs" thanks to the trigger hack
            // We can use it directly or try to clean it up if we want.
            // But let's trust the trigger's formatting for the body.
            const val = parseFloat(record.valor_total || record.valor_frete || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            const rawObs = record.observacao || ""

            // "Loja: Drogasil - obs" -> "Drogasil"
            let estabName = "Uma loja"
            if (rawObs.startsWith("Loja: ")) {
                const parts = rawObs.split(" - ")
                estabName = parts[0].replace("Loja: ", "")
            }

            const body = `${estabName} solicitou uma entrega\nValor: ${val}`

            // CLICK URL
            // Using query param to handle routing client-side (bypasses 404)
            const clickUrl = "https://rapidusexpress.vercel.app/?view=inbox"

            for (const admin of admins) {
                if (admin.push_token) {
                    try {
                        // Handle token string parsing
                        let sub = admin.push_token
                        if (typeof sub === 'string') {
                            try { sub = JSON.parse(sub) } catch (e) { console.error("Bad JSON token", e) }
                        }

                        if (sub && sub.endpoint) {
                            const promise = webpush.sendNotification(sub, JSON.stringify({
                                title: title,
                                body: body,
                                url: clickUrl
                            }))
                            notifications.push(promise)
                        }
                    } catch (e) {
                        console.error("LOG: Push Error", e)
                    }
                }
            }

            await Promise.allSettled(notifications)
            return new Response(JSON.stringify({ message: "Processed" }), { headers: { 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ message: "Ignored" }), { headers: { 'Content-Type': 'application/json' } })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
})
