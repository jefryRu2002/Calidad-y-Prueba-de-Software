package com.reparaciones.paginaweb.controllers;

import com.reparaciones.paginaweb.models.*;
import com.reparaciones.paginaweb.repositories.*;
import com.reparaciones.paginaweb.services.NotificacionService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/cotizaciones")
@CrossOrigin(origins = "*")
@SuppressWarnings("unchecked")
public class CotizacionController {

    private final CotizacionRepository cotizacionRepository;
    private final OrdenTrabajoRepository ordenTrabajoRepository;
    private final PersonaRepository personaRepository;
    private final NotificacionService notificacionService;

    public CotizacionController(CotizacionRepository cotizacionRepository,
                                 OrdenTrabajoRepository ordenTrabajoRepository,
                                 PersonaRepository personaRepository,
                                 NotificacionService notificacionService) {
        this.cotizacionRepository = cotizacionRepository;
        this.ordenTrabajoRepository = ordenTrabajoRepository;
        this.personaRepository = personaRepository;
        this.notificacionService = notificacionService;
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        try {
            List<CotizacionModel> cotizaciones = cotizacionRepository.findAll();
            return ResponseEntity.ok(cotizaciones.stream().map(this::formatear).collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Integer id) {
        try {
            CotizacionModel cot = cotizacionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cotización no encontrada"));
            return ResponseEntity.ok(formatear(cot));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== CREAR COTIZACIÓN (técnico) ====================
    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Map<String, Object> datos) {
        try {
            CotizacionModel cot = new CotizacionModel();

            Integer idOrden = Integer.parseInt(datos.get("idOrden").toString());
            Integer idTecnico = Integer.parseInt(datos.get("idTecnico").toString());

            OrdenTrabajo orden = ordenTrabajoRepository.findById(idOrden)
                .orElseThrow(() -> new RuntimeException("Orden no encontrada"));
            TecnicoModel tecnico = new TecnicoModel();
            tecnico.setIdPersona(idTecnico);

            cot.setOrden(orden);
            cot.setTecnico(tecnico);
            cot.setManoObra(new BigDecimal(datos.getOrDefault("manoObra", "0").toString()));
            cot.setNotas((String) datos.getOrDefault("notas", ""));
            cot.setEstado("PENDIENTE_ADMIN");

            // ==================== REPUESTOS ====================
            BigDecimal totalRepuestos = BigDecimal.ZERO;
            List<Map<String, Object>> repuestosList = (List<Map<String, Object>>) datos.get("repuestos");
            if (repuestosList != null) {
                for (Map<String, Object> r : repuestosList) {
                    CotizacionRepuestoModel cr = new CotizacionRepuestoModel();
                    cr.setNombre(r.get("nombre").toString());
                    cr.setCantidad(Integer.parseInt(r.getOrDefault("cantidad", "1").toString()));
                    cr.setPrecioUnitario(new BigDecimal(r.get("precioUnitario").toString()));
                    cr.setCotizacion(cot);
                    cot.getRepuestos().add(cr);
                    BigDecimal subtotal = cr.getPrecioUnitario().multiply(BigDecimal.valueOf(cr.getCantidad()));
                    totalRepuestos = totalRepuestos.add(subtotal);
                }
            }

            // ==================== TRABAJOS ====================
            BigDecimal totalTrabajos = BigDecimal.ZERO;
            List<Map<String, Object>> trabajosList = (List<Map<String, Object>>) datos.get("trabajos");
            if (trabajosList != null) {
                for (Map<String, Object> t : trabajosList) {
                    CotizacionTrabajoModel ct = new CotizacionTrabajoModel();
                    ct.setDescripcion(t.get("descripcion").toString());
                    BigDecimal costo = new BigDecimal(t.getOrDefault("costo", "0").toString());
                    ct.setCosto(costo);
                    ct.setCotizacion(cot);
                    cot.getTrabajos().add(ct);
                    totalTrabajos = totalTrabajos.add(costo);
                }
            }

            // 🔥 TOTAL = repuestos + mano de obra + trabajos
            cot.setTotalRepuestos(totalRepuestos);
            cot.setTotal(totalRepuestos.add(cot.getManoObra()).add(totalTrabajos));

            CotizacionModel saved = cotizacionRepository.save(cot);

            // Cambiar estado de la orden a COTIZADO
            orden.setEstado("COTIZADO");
            ordenTrabajoRepository.save(orden);

            notificacionService.crearNotificacion(
                "TICKET",
                "Nueva Cotización Creada",
                "Cotización #" + saved.getIdCotizacion() + " para OT-" + idOrden + " por S/." + saved.getTotal(),
                saved.getIdCotizacion()
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "mensaje", "Cotización creada",
                "idCotizacion", saved.getIdCotizacion(),
                "total", saved.getTotal()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/tecnico/{idTecnico}")
    public ResponseEntity<?> getPorTecnico(@PathVariable Integer idTecnico) {
        List<CotizacionModel> cotizaciones = cotizacionRepository.findAll().stream()
            .filter(c -> c.getTecnico() != null && c.getTecnico().getIdPersona().equals(idTecnico))
            .collect(Collectors.toList());
        return ResponseEntity.ok(cotizaciones.stream().map(this::formatear).collect(Collectors.toList()));
    }

    @GetMapping("/orden/{idOrden}")
    public ResponseEntity<?> getPorOrden(@PathVariable Integer idOrden) {
        List<CotizacionModel> cots = cotizacionRepository.findByIdOrden(idOrden);
        if (cots.isEmpty()) return ResponseEntity.ok(new ArrayList<>());
        return ResponseEntity.ok(formatear(cots.get(0)));
    }

    // ==================== APROBAR POR ADMIN ====================
    @PutMapping("/{id}/aprobar-admin")
    public ResponseEntity<?> aprobarAdmin(@PathVariable Integer id) {
        try {
            CotizacionModel cot = cotizacionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cotización no encontrada"));
            cot.setEstado("APROBADA_ADMIN");
            cot.setFechaRespuesta(LocalDateTime.now());
            cotizacionRepository.save(cot);

            OrdenTrabajo ot = cot.getOrden();
            if (ot != null) {
                ot.setEstado("COTIZACION_APROBADA");
                ordenTrabajoRepository.save(ot);
            }

            notificacionService.crearNotificacion(
                "TICKET",
                "Cotización Aprobada por Admin",
                "Cotización #" + id + " aprobada. Esperando cliente.",
                id
            );

            return ResponseEntity.ok(Map.of("mensaje", "Cotización aprobada por admin"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== RECHAZAR POR ADMIN ====================
    @PutMapping("/{id}/rechazar-admin")
    public ResponseEntity<?> rechazarAdmin(@PathVariable Integer id) {
        try {
            CotizacionModel cot = cotizacionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cotización no encontrada"));
            cot.setEstado("RECHAZADA_ADMIN");
            cot.setFechaRespuesta(LocalDateTime.now());
            cotizacionRepository.save(cot);

            OrdenTrabajo ot = cot.getOrden();
            if (ot != null) {
                ot.setEstado("COTIZACION_RECHAZADA_ADMIN");
                ordenTrabajoRepository.save(ot);
            }

            notificacionService.crearNotificacion(
                "TICKET",
                "Cotización Rechazada por Admin",
                "Cotización #" + id + " rechazada. Vuelve al técnico.",
                id
            );

            return ResponseEntity.ok(Map.of("mensaje", "Cotización rechazada por admin"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== APROBAR POR CLIENTE ====================
    @PutMapping("/{id}/aprobar-cliente")
    public ResponseEntity<?> aprobarCliente(@PathVariable Integer id) {
        try {
            CotizacionModel cot = cotizacionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cotización no encontrada"));

            if (!"APROBADA_ADMIN".equals(cot.getEstado())) {
                return ResponseEntity.badRequest().body(Map.of("error", "La cotización aún no está aprobada por el admin"));
            }

            cot.setEstado("APROBADA_CLIENTE");
            cot.setFechaRespuesta(LocalDateTime.now());
            cotizacionRepository.save(cot);

            OrdenTrabajo ot = cot.getOrden();
            if (ot != null) {
                ot.setEstado("EN_REPARACION");
                ordenTrabajoRepository.save(ot);
            }

            notificacionService.crearNotificacion(
                "TICKET",
                "Cliente Aprobó la Cotización",
                "Cotización #" + id + " aprobada. Inicia reparación.",
                id
            );

            return ResponseEntity.ok(Map.of("mensaje", "Cotización aprobada por cliente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== RECHAZAR POR CLIENTE ====================
    @PutMapping("/{id}/rechazar-cliente")
    public ResponseEntity<?> rechazarCliente(@PathVariable Integer id) {
        try {
            CotizacionModel cot = cotizacionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cotización no encontrada"));

            cot.setEstado("RECHAZADA_CLIENTE");
            cot.setFechaRespuesta(LocalDateTime.now());
            cotizacionRepository.save(cot);

            OrdenTrabajo ot = cot.getOrden();
            if (ot != null) {
                ot.setEstado("DEVUELTO");
                ordenTrabajoRepository.save(ot);
            }

            notificacionService.crearNotificacion(
                "TICKET",
                "Cliente Rechazó la Cotización",
                "Cotización #" + id + " rechazada. Equipo a devolución.",
                id
            );

            return ResponseEntity.ok(Map.of("mensaje", "Cotización rechazada por cliente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== FORMATEAR (con totalTrabajos) ====================
    private Map<String, Object> formatear(CotizacionModel cot) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("idCotizacion", cot.getIdCotizacion());
        data.put("estado", cot.getEstado());
        data.put("totalRepuestos", cot.getTotalRepuestos() != null ? cot.getTotalRepuestos() : BigDecimal.ZERO);
        data.put("manoObra", cot.getManoObra() != null ? cot.getManoObra() : BigDecimal.ZERO);
        data.put("total", cot.getTotal() != null ? cot.getTotal() : BigDecimal.ZERO);
        data.put("notas", cot.getNotas() != null ? cot.getNotas() : "");
        data.put("fechaCreacion", cot.getFechaCreacion());
        data.put("fechaRespuesta", cot.getFechaRespuesta());

        // 🔥 CALCULAR totalTrabajos
        BigDecimal totalTrabajos = cot.getTrabajos().stream()
            .map(t -> t.getCosto() != null ? t.getCosto() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        data.put("totalTrabajos", totalTrabajos);

        if (cot.getOrden() != null) {
            OrdenTrabajo ot = cot.getOrden();
            data.put("idOrden", ot.getIdOrden());
            data.put("estadoOrden", ot.getEstado());
            if (ot.getReporte() != null) {
                data.put("marca", ot.getReporte().getMarca());
                data.put("modelo", ot.getReporte().getModelo());
                data.put("equipo", (ot.getReporte().getMarca() != null ? ot.getReporte().getMarca() : "") + " " +
                                    (ot.getReporte().getModelo() != null ? ot.getReporte().getModelo() : ""));
                data.put("descripcionFalla", ot.getReporte().getDescripcionFalla());
                if (ot.getReporte().getPersona() != null) {
                    PersonaModel p = ot.getReporte().getPersona();
                    data.put("nombreCliente", ((p.getNombre() != null ? p.getNombre() : "") + " " +
                                              (p.getApellido() != null ? p.getApellido() : "")).trim());
                }
            }
        }

        if (cot.getTecnico() != null && cot.getTecnico().getPersona() != null) {
            PersonaModel p = cot.getTecnico().getPersona();
            data.put("idTecnico", cot.getTecnico().getIdPersona());
            data.put("nombreTecnico", ((p.getNombre() != null ? p.getNombre() : "") + " " +
                                      (p.getApellido() != null ? p.getApellido() : "")).trim());
        }

        // 🔥 REPUESTOS
        data.put("repuestos", cot.getRepuestos().stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("nombre", r.getNombre());
            m.put("cantidad", r.getCantidad());
            m.put("precioUnitario", r.getPrecioUnitario());
            m.put("subtotal", r.getPrecioUnitario().multiply(BigDecimal.valueOf(r.getCantidad())));
            return m;
        }).collect(Collectors.toList()));

        // 🔥 TRABAJOS
        data.put("trabajos", cot.getTrabajos().stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("descripcion", t.getDescripcion());
            m.put("costo", t.getCosto());
            return m;
        }).collect(Collectors.toList()));

        return data;
    }
}