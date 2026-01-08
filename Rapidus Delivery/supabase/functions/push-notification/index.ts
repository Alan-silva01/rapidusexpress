
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import webpush from "npm:web-push@3.6.4"

// VAPID Keys
const VAPID_PUBLIC_KEY = "BAfEBFOtIe1ByawG9QhfIlKSL2XNbEnjSn0HtJYIyuMtmQdgykJAxRT9CSQuBuPORnJVGv6rwOgd2QEPpEzH85c"
const VAPID_PRIVATE_KEY = "Oo4t8-GsITMWYugHUtywc9pGNBubcfGmeazsmww2rjI"

webpush.setVapidDetails(
    'mailto:alan@rapidus.delivery',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
)

serve(async (req) => {
    try {
        const { record, type, table } = await req.json()
        console.log("LOG: Payload received", { type, table, record })

        if (type === 'INSERT' && (table === 'entregas' || table === 'clientes')) {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

            // Fetch Admins
            const adminResponse = await fetch(`${supabaseUrl}/rest/v1/perfis?funcao=eq.admin&select=push_token`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            })
            const admins = await adminResponse.json()

            const notifications = []

            // --- CUSTOM FORMATTING START ---
            const title = "NOVA ENTREGA DISPONÍVEL"

            // Parse Value
            const val = parseFloat(record.valor_total || record.valor_frete || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

            // Parse Estabelecimento (Fallback to 'Parceiro' if missing)
            const estab = record.estabelecimento || "Parceiro"

            // Body format: "DROGASIL solicitou uma entrega - R$ 5.00 \n toque para ver"
            const body = `${estab} solicitou uma entrega - ${val}\ntoque para ver`
            // --- CUSTOM FORMATTING END ---

            for (const admin of admins) {
                if (admin.push_token) {
                    try {
                        // Handle different token formats (string vs object)
                        const sub = typeof admin.push_token === 'string' ? JSON.parse(admin.push_token) : admin.push_token
                        if (sub && sub.endpoint) {
                            const promise = webpush.sendNotification(sub, JSON.stringify({
                                title: title,
                                body: body,
                                url: 'https://rapidusexpress.vercel.app/admin'
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
