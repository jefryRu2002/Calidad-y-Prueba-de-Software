package com.reparaciones.paginaweb.controllers;

import com.reparaciones.paginaweb.models.PagoModel;
import com.reparaciones.paginaweb.models.OrdenTrabajo;
import com.reparaciones.paginaweb.services.PagoService;
import com.reparaciones.paginaweb.services.NotificacionService;
import com.reparaciones.paginaweb.repositories.OrdenTrabajoRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/pagos")
@CrossOrigin(origins = "*")
public class PagoController {

    private final PagoService pagoService;
    private final OrdenTrabajoRepository ordenTrabajoRepository;
    private final NotificacionService notificacionService;

    public PagoController(PagoService pagoService,
                           OrdenTrabajoRepository ordenTrabajoRepository,
                           NotificacionService notificacionService) {
        this.pagoService = pagoService;
        this.ordenTrabajoRepository = ordenTrabajoRepository;
        this.notificacionService = notificacionService;
    }

    @GetMapping
    public ResponseEntity<List<PagoModel>> findAll() {
        return ResponseEntity.ok(pagoService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PagoModel> findById(@PathVariable Integer id) {
        return ResponseEntity.ok(pagoService.findById(id));
    }

    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<PagoModel>> findByEstado(@PathVariable String estado) {
        return ResponseEntity.ok(pagoService.findByEstado(estado));
    }

    @GetMapping("/orden/{idOrden}")
    public ResponseEntity<List<PagoModel>> findByOrdenTrabajo(@PathVariable Integer idOrden) {
        return ResponseEntity.ok(pagoService.findByOrdenTrabajo(idOrden));
    }

    // ==================== PROCESAR PAGO (cliente) ====================
    @PostMapping("/procesar")
    public ResponseEntity<?> procesarPago(@RequestBody Map<String, Object> datos) {
        try {
            // ⚠️ En el front se manda "pago_id" pero en realidad es el idOrden
            Integer idOrden = Integer.parseInt(datos.get("pago_id").toString());

            OrdenTrabajo ot = ordenTrabajoRepository.findById(idOrden)
                .orElseThrow(() -> new RuntimeException("Orden no encontrada"));

            // Verificar que la orden está lista para pagar
            if (!Boolean.TRUE.equals(ot.getPuedePagar())) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Esta orden aún no está lista para pago"));
            }

            PagoModel pago = new PagoModel();
            pago.setOrdenTrabajo(ot);
            pago.setMonto(new BigDecimal(datos.get("monto").toString()));
            pago.setMoneda("PEN");
            pago.setEstado("PAGADO");  // PAGADO, esperando aprobación del admin
            pago.setMetodoPago(datos.get("metodo_pago") != null ?
                datos.get("metodo_pago").toString() : "TRANSFERENCIA");
            pago.setFechaPago(LocalDateTime.now());
            pago.setFechaCreacion(LocalDateTime.now());

            PagoModel saved = pagoService.save(pago);

            // Bloquear el botón de pagar (ya pagó)
            ot.setPuedePagar(false);
            // NO cambiar estado de la orden. Queda en TERMINADO.
            ordenTrabajoRepository.save(ot);

            notificacionService.crearNotificacion(
                "PAGO",
                "Pago Registrado",
                "El cliente pagó S/." + saved.getMonto() + " para OT-" + idOrden,
                saved.getIdpagos()
            );

            return ResponseEntity.ok(Map.of(
                "mensaje", "Pago registrado exitosamente",
                "id_pago", saved.getIdpagos()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== APROBAR PAGO (admin) ====================
    @PutMapping("/{id}/aprobar")
    public ResponseEntity<?> aprobarPago(@PathVariable Integer id) {
        try {
            PagoModel pago = pagoService.findById(id);
            pago.setEstado("APROBADO");
            pagoService.save(pago);

            // 🔥 Al aprobar pago, la orden pasa a ENTREGADO
            OrdenTrabajo ot = pago.getOrdenTrabajo();
            if (ot != null) {
                ot.setEstado("ENTREGADO");
                ordenTrabajoRepository.save(ot);
            }

            notificacionService.crearNotificacion(
                "PAGO",
                "Pago Aprobado",
                "El pago #" + id + " por S/." + pago.getMonto() + " ha sido aprobado.",
                id
            );

            return ResponseEntity.ok(Map.of(
                "mensaje", "Pago aprobado y orden entregada",
                "estadoOrden", "ENTREGADO"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== RECHAZAR PAGO (admin) ====================
    @PutMapping("/{id}/rechazar")
    public ResponseEntity<?> rechazarPago(@PathVariable Integer id,
                                           @RequestBody(required = false) Map<String, String> datos) {
        try {
            PagoModel pago = pagoService.findById(id);
            pago.setEstado("RECHAZADO");
            pagoService.save(pago);

            // Devolver permiso de pagar al cliente
            OrdenTrabajo ot = pago.getOrdenTrabajo();
            if (ot != null) {
                ot.setPuedePagar(true);
                ordenTrabajoRepository.save(ot);
            }

            String motivo = (datos != null && datos.get("motivo") != null) ?
                datos.get("motivo") : "Sin motivo especificado";

            notificacionService.crearNotificacion(
                "PAGO",
                "Pago Rechazado",
                "El pago #" + id + " fue rechazado. Motivo: " + motivo,
                id
            );

            return ResponseEntity.ok(Map.of("mensaje", "Pago rechazado"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== OTROS ENDPOINTS (los mantenemos) ====================
    @GetMapping("/cliente/{idCliente}")
    public ResponseEntity<List<Map<String, Object>>> getPagosCliente(
            @PathVariable Integer idCliente,
            @RequestParam(required = false) String estado) {

        List<OrdenTrabajo> ordenes = ordenTrabajoRepository.findAll();
        List<Integer> ordenesCliente = new ArrayList<>();

        for (OrdenTrabajo ot : ordenes) {
            if (ot.getReporte() != null &&
                ot.getReporte().getIdPersona() != null &&
                ot.getReporte().getIdPersona().equals(idCliente)) {
                ordenesCliente.add(ot.getIdOrden());
            }
        }

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (Integer idOrden : ordenesCliente) {
            List<PagoModel> pagos = pagoService.findByOrdenTrabajo(idOrden);
            for (PagoModel p : pagos) {
                if (estado == null || estado.equals(p.getEstado())) {
                    resultado.add(pagoToMap(p));
                }
            }
        }
        return ResponseEntity.ok(resultado);
    }

    @GetMapping("/cliente/{idCliente}/historial")
    public ResponseEntity<List<Map<String, Object>>> getHistorialPagos(@PathVariable Integer idCliente) {
        return getPagosCliente(idCliente, null);
    }

    @GetMapping("/verificar/{transactionId}")
    public ResponseEntity<?> verificarPago(@PathVariable String transactionId) {
        Optional<PagoModel> pagoOpt = pagoService.findByIzipayOrderId(transactionId);
        if (pagoOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Pago no encontrado"));
        }
        PagoModel pago = pagoOpt.get();
        return ResponseEntity.ok(Map.of(
            "estado", pago.getEstado() != null ? pago.getEstado() : "PENDIENTE",
            "transactionId", pago.getIzipayOrderId(),
            "monto", pago.getMonto()
        ));
    }

    @PostMapping("/notificacion")
    public ResponseEntity<?> notificacionIzipay(@RequestBody Map<String, Object> datos) {
        String transactionId = datos.get("transactionId") != null ?
            datos.get("transactionId").toString() : "";
        String estado = datos.get("status") != null ?
            datos.get("status").toString() : "";

        Optional<PagoModel> pagoOpt = pagoService.findByIzipayOrderId(transactionId);
        if (pagoOpt.isPresent()) {
            PagoModel pago = pagoOpt.get();
            if ("SUCCESS".equalsIgnoreCase(estado)) {
                pago.setEstado("APROBADO");
                pago.setFechaPago(LocalDateTime.now());
            } else {
                pago.setEstado("RECHAZADO");
            }
            pagoService.save(pago);
        }
        return ResponseEntity.ok(Map.of("mensaje", "Notificación recibida"));
    }

    private Map<String, Object> pagoToMap(PagoModel p) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", p.getIdpagos());
        data.put("id_pago", p.getIdpagos());
        data.put("monto", p.getMonto());
        data.put("descripcion", "Reparación de equipo");
        data.put("estado", p.getEstado());
        data.put("metodo_pago", p.getMetodoPago());
        data.put("fecha_pago", p.getFechaPago() != null ? p.getFechaPago().toString() : null);
        data.put("ticket", p.getOrdenTrabajo() != null ? "OT-" + p.getOrdenTrabajo().getIdOrden() : "");
        data.put("id_orden", p.getOrdenTrabajo() != null ? p.getOrdenTrabajo().getIdOrden() : null);
        data.put("izipay_order_id", p.getIzipayOrderId());
        data.put("tarjeta_marca", p.getTarjetaMarca());
        return data;
    }
}