"""
invoice.py — Generación de facturas PDF y envío por email.
Usa ReportLab para el PDF y Resend para el email.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from app.models.models import Sale
from app.core.config import settings

# Colores Nocturna
BURGUNDY = HexColor("#8B1A2E")
DARK_BG  = HexColor("#111111")
GRAY     = HexColor("#888888")
LIGHT    = HexColor("#F5F5F5")


def generate_invoice_pdf(sale: Sale) -> bytes:
    """Genera el PDF de la factura y retorna los bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # ── Estilo base ──
    title_style = ParagraphStyle(
        "Title", fontSize=22, textColor=BURGUNDY,
        fontName="Helvetica-Bold", alignment=TA_LEFT, spaceAfter=2
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", fontSize=10, textColor=GRAY,
        fontName="Helvetica", alignment=TA_LEFT, spaceAfter=2
    )
    normal_style = ParagraphStyle(
        "Normal", fontSize=9, textColor=black,
        fontName="Helvetica", spaceAfter=2
    )
    right_style = ParagraphStyle(
        "Right", fontSize=9, textColor=black,
        fontName="Helvetica", alignment=TA_RIGHT
    )
    total_style = ParagraphStyle(
        "Total", fontSize=13, textColor=BURGUNDY,
        fontName="Helvetica-Bold", alignment=TA_RIGHT
    )

    # ── HEADER ──
    elements.append(Paragraph("NOCTURNA", title_style))
    elements.append(Paragraph("Factura de venta", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=BURGUNDY, spaceAfter=8))

    # ── INFO FACTURA ──
    info_data = [
        ["Factura #", f"{sale.id:06d}", "Fecha", sale.created_at.strftime("%d/%m/%Y %H:%M")],
        ["Cajero", sale.user.name if sale.user else "—", "Método pago", sale.payment_method.value.upper()],
    ]
    if sale.client:
        info_data.append(["Cliente", sale.client.name, "Puntos ganados", f"+{int(sale.total // 1000)}"])

    info_table = Table(info_data, colWidths=[35*mm, 65*mm, 35*mm, 45*mm])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), BURGUNDY),
        ("TEXTCOLOR", (2, 0), (2, -1), BURGUNDY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 6*mm))

    # ── TABLA DE PRODUCTOS ──
    headers = ["Producto", "Cant.", "Precio unit.", "Subtotal"]
    rows = [headers]

    for item in sale.items:
        rows.append([
            item.product.name if item.product else "Producto",
            str(item.quantity),
            f"${item.unit_price:,.0f}",
            f"${item.subtotal:,.0f}",
        ])

    col_widths = [90*mm, 20*mm, 40*mm, 40*mm]
    items_table = Table(rows, colWidths=col_widths)
    items_table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), BURGUNDY),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        # Filas
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, white]),
        ("GRID", (0, 0), (-1, -1), 0.3, GRAY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 4*mm))

    # ── TOTALES ──
    totals_data = []
    totals_data.append(["Subtotal", f"${sale.subtotal:,.0f} COP"])
    if sale.discount_amount > 0:
        totals_data.append(["Descuento", f"-${sale.discount_amount:,.0f} COP"])
    totals_data.append(["TOTAL", f"${sale.total:,.0f} COP"])
    if sale.amount_paid:
        totals_data.append(["Pagado", f"${sale.amount_paid:,.0f} COP"])
        totals_data.append(["Vuelto", f"${sale.change_amount:,.0f} COP"])

    totals_table = Table(totals_data, colWidths=[130*mm, 60*mm])
    totals_style = [
        ("FONTNAME", (0, 0), (-1, -2), "Helvetica"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold") if sale.amount_paid else ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TEXTCOLOR", (0, 0), (-1, -1), black),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    # Resaltar fila TOTAL
    total_row = 1 if sale.discount_amount == 0 else 2
    totals_style += [
        ("FONTSIZE", (0, total_row), (-1, total_row), 12),
        ("FONTNAME", (0, total_row), (-1, total_row), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, total_row), (-1, total_row), BURGUNDY),
        ("LINEABOVE", (0, total_row), (-1, total_row), 1, BURGUNDY),
    ]
    totals_table.setStyle(TableStyle(totals_style))
    elements.append(totals_table)

    # ── FOOTER ──
    elements.append(Spacer(1, 8*mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=GRAY))
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(
        f"Gracias por tu compra · {settings.APP_NAME} · {settings.BUILT_BY}",
        ParagraphStyle("Footer", fontSize=8, textColor=GRAY, alignment=TA_CENTER)
    ))

    doc.build(elements)
    return buffer.getvalue()


async def send_invoice_email(sale: Sale) -> bool:
    """
    Envía la factura PDF por email al cliente usando Resend.
    Retorna True si el envío fue exitoso.
    """
    if not sale.client or not sale.client.email:
        return False

    if not settings.RESEND_API_KEY or settings.RESEND_API_KEY.startswith("re_xxx"):
        # En desarrollo sin API key configurada, solo logueamos
        print(f"📧 [DEV] Factura #{sale.id} lista para {sale.client.email} (Resend no configurado)")
        return True

    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY

        pdf_bytes = generate_invoice_pdf(sale)

        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": sale.client.email,
            "subject": f"Tu factura Nocturna #{sale.id:06d}",
            "html": f"""
                <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
                    <h2 style="color:#8B1A2E">Nocturna</h2>
                    <p>Hola <strong>{sale.client.name}</strong>, gracias por tu compra.</p>
                    <p>Adjunto encontrarás tu factura <strong>#{sale.id:06d}</strong>
                    por un total de <strong>${sale.total:,.0f} COP</strong>.</p>
                    <hr style="border-color:#eee">
                    <p style="color:#888;font-size:12px">
                        {settings.APP_NAME} · {settings.BUILT_BY}
                    </p>
                </div>
            """,
            "attachments": [{
                "filename": f"factura-nocturna-{sale.id:06d}.pdf",
                "content": list(pdf_bytes),
            }],
        })
        return True

    except Exception as e:
        print(f"❌ Error enviando email factura #{sale.id}: {e}")
        return False
