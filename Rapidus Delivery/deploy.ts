
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

        if ((type === 'INSERT' && (table === 'entregas' || table === 'clientes')) || type === 'REJECT') {
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

            for (const admin of admins) {
                if (admin.push_token) {
                    try {
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
