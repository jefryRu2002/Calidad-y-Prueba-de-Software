package com.reparaciones.paginaweb.controllers;

import com.reparaciones.paginaweb.models.*;
import com.reparaciones.paginaweb.services.*;
import com.reparaciones.paginaweb.repositories.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ordenes-trabajo")
@CrossOrigin(origins = "*")
public class OrdenTrabajoController {

    private final OrdenTrabajoService ordenTrabajoService;
    private final CotizacionRepository cotizacionRepository;
    private final NotificacionService notificacionService;
    private final ReparacionTrabajoRepository reparacionTrabajoRepository;
    private final ReparacionRepuestoRepository reparacionRepuestoRepository;

    public OrdenTrabajoController(OrdenTrabajoService ordenTrabajoService,
                                   CotizacionRepository cotizacionRepository,
                                   NotificacionService notificacionService,
                                   ReparacionTrabajoRepository reparacionTrabajoRepository,
                                   ReparacionRepuestoRepository reparacionRepuestoRepository) {
        this.ordenTrabajoService = ordenTrabajoService;
        this.cotizacionRepository = cotizacionRepository;
        this.notificacionService = notificacionService;
        this.reparacionTrabajoRepository = reparacionTrabajoRepository;
        this.reparacionRepuestoRepository = reparacionRepuestoRepository;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> findAll() {
        List<OrdenTrabajo> ordenes = ordenTrabajoService.findAll();
        List<Map<String, Object>> resultado = new ArrayList<>();
        for (OrdenTrabajo ot : ordenes) {
            resultado.add(convertirOrdenAMapa(ot));
        }
        return ResponseEntity.ok(resultado);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> findById(@PathVariable Integer id) {
        try {
            OrdenTrabajo ot = ordenTrabajoService.findById(id);
            return ResponseEntity.ok(convertirOrdenAMapa(ot));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<Map<String, Object>>> findByEstado(@PathVariable String estado) {
        List<OrdenTrabajo> ordenes = ordenTrabajoService.findByEstado(estado);
        List<Map<String, Object>> resultado = new ArrayList<>();
        for (OrdenTrabajo ot : ordenes) {
            resultado.add(convertirOrdenAMapa(ot));
        }
        return ResponseEntity.ok(resultado);
    }

    @GetMapping("/tecnico/{idTecnico}")
    public ResponseEntity<List<Map<String, Object>>> findByTecnico(@PathVariable Integer idTecnico) {
        List<OrdenTrabajo> ordenes = ordenTrabajoService.findByTecnico(idTecnico);
        List<Map<String, Object>> resultado = new ArrayList<>();
        for (OrdenTrabajo ot : ordenes) {
            resultado.add(convertirOrdenAMapa(ot));
        }
        return ResponseEntity.ok(resultado);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> datos) {
        try {
            OrdenTrabajo orden = new OrdenTrabajo();

            Object idTicket = getValue(datos, "idTicket", "id_ticket", "idReporte", "id_reporte");
            if (idTicket != null && !idTicket.toString().isEmpty()) {
                ReporteFallaModel r = new ReporteFallaModel();
                r.setIdReporte(Integer.parseInt(idTicket.toString()));
                orden.setReporte(r);
            }

            Object idEquipo = getValue(datos, "idEquipo", "id_equipo");
            if (idEquipo != null && !idEquipo.toString().isEmpty()) {
                EquipoModel e = new EquipoModel();
                e.setIdEquipo(Integer.parseInt(idEquipo.toString()));
                orden.setEquipo(e);
            }

            Object idTecnico = getValue(datos, "idTecnico", "id_tecnico");
            if (idTecnico != null && !idTecnico.toString().isEmpty() && !idTecnico.toString().equals("null")) {
                TecnicoModel t = new TecnicoModel();
                t.setIdPersona(Integer.parseInt(idTecnico.toString()));
                orden.setTecnico(t);
            }

            String estado = getString(datos, "estado");
            orden.setEstado(estado != null && !estado.isEmpty() ? estado : "PENDIENTE");

            String fechaStr = getString(datos, "fechaInicio", "fecha_inicio", "fecha_ingreso");
            if (fechaStr != null && !fechaStr.isEmpty()) {
                orden.setFechaInicio(parseFecha(fechaStr));
            }

            OrdenTrabajo saved = ordenTrabajoService.save(orden);

            notificacionService.crearNotificacion(
                "TICKET",
                "Nueva Orden de Trabajo",
                "Se ha creado la orden OT-" + saved.getIdOrden() + " con estado: " + orden.getEstado(),
                saved.getIdOrden()
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "mensaje", "Orden creada exitosamente",
                "idOrden", saved.getIdOrden()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Error al crear orden: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody Map<String, Object> datos) {
        try {
            OrdenTrabajo orden = ordenTrabajoService.findById(id);
            String estadoAnterior = orden.getEstado();

            Object idTecnico = getValue(datos, "idTecnico", "id_tecnico");
            if (idTecnico != null) {
                String idStr = idTecnico.toString();
                if (!idStr.isEmpty() && !idStr.equals("null")) {
                    TecnicoModel t = new TecnicoModel();
                    t.setIdPersona(Integer.parseInt(idStr));
                    orden.setTecnico(t);
                }
            }

            String estado = getString(datos, "estado");
            if (estado != null && !estado.isEmpty()) {
                orden.setEstado(estado);
            }

            String fechaInicioStr = getString(datos, "fechaInicio", "fecha_inicio");
            if (fechaInicioStr != null && !fechaInicioStr.isEmpty()) {
                orden.setFechaInicio(parseFecha(fechaInicioStr));
            }

            String fechaFinStr = getString(datos, "fechaFin", "fecha_fin");
            if (fechaFinStr != null && !fechaFinStr.isEmpty()) {
                orden.setFechaFin(parseFecha(fechaFinStr));
            }

            Object puedePagar = getValue(datos, "puedePagar", "puede_pagar");
            if (puedePagar != null) {
                orden.setPuedePagar(Boolean.parseBoolean(puedePagar.toString()));
            }

            String notasTecnico = getString(datos, "notasTecnico", "notas_tecnico");
            if (notasTecnico != null) {
                orden.setNotasTecnico(notasTecnico);
            }

            ordenTrabajoService.update(id, orden);

            if (estado != null && !estado.isEmpty() && !estado.equals(estadoAnterior)) {
                notificacionService.crearNotificacion(
                    "REPARACION",
                    "Cambio de Estado",
                    "OT-" + id + " cambió de '" + estadoAnterior + "' a '" + estado + "'",
                    id
                );
            }

            return ResponseEntity.ok(Map.of(
                "mensaje", "Orden actualizada exitosamente",
                "idOrden", id
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Error al actualizar: " + e.getMessage()));
        }
    }

    // ==================== ASIGNAR TÉCNICO ====================
    @PutMapping("/{id}/asignar-tecnico/{idTecnico}")
    public ResponseEntity<?> asignarTecnico(@PathVariable Integer id, @PathVariable Integer idTecnico) {
        try {
            OrdenTrabajo orden = ordenTrabajoService.asignarTecnico(id, idTecnico);

            notificacionService.crearNotificacion(
                "REPARACION",
                "Técnico Asignado",
                "La orden OT-" + id + " fue asignada al técnico #" + idTecnico,
                id
            );

            return ResponseEntity.ok(Map.of(
                "mensaje", "Técnico asignado correctamente",
                "idOrden", id,
                "estado", "ASIGNADO"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== GUARDAR TRABAJOS Y REPUESTOS ====================
    @PutMapping("/{id}/reparacion")
    public ResponseEntity<?> guardarReparacion(@PathVariable Integer id, @RequestBody Map<String, Object> datos) {
        try {
            List<Map<String, Object>> trabajosMap = (List<Map<String, Object>>) datos.get("trabajos");
            List<Map<String, Object>> repuestosMap = (List<Map<String, Object>>) datos.get("repuestos");
            String notas = (String) datos.getOrDefault("notas", "");

            List<ReparacionTrabajoModel> trabajos = new ArrayList<>();
            if (trabajosMap != null) {
                for (Map<String, Object> t : trabajosMap) {
                    ReparacionTrabajoModel rt = new ReparacionTrabajoModel();
                    rt.setDescripcion(t.get("descripcion").toString());
                    trabajos.add(rt);
                }
            }

            List<ReparacionRepuestoModel> repuestos = new ArrayList<>();
            if (repuestosMap != null) {
                for (Map<String, Object> r : repuestosMap) {
                    ReparacionRepuestoModel rr = new ReparacionRepuestoModel();
                    rr.setNombre(r.get("nombre").toString());
                    rr.setCantidad(Integer.parseInt(r.getOrDefault("cantidad", "1").toString()));
                    rr.setPrecioUnitario(new BigDecimal(r.getOrDefault("precio", "0").toString()));
                    repuestos.add(rr);
                }
            }

            OrdenTrabajo orden = ordenTrabajoService.guardarDetallesReparacion(id, trabajos, repuestos, notas);

            return ResponseEntity.ok(Map.of(
                "mensaje", "Reparación guardada",
                "idOrden", orden.getIdOrden()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== AVANZAR A PRUEBAS ====================
    @PutMapping("/{id}/avanzar-pruebas")
    public ResponseEntity<?> avanzarAPruebas(@PathVariable Integer id) {
        try {
            OrdenTrabajo orden = ordenTrabajoService.avanzarAPruebas(id);
            notificacionService.crearNotificacion(
                "REPARACION",
                "Orden en Pruebas",
                "La orden OT-" + id + " está en fase de pruebas",
                id
            );
            return ResponseEntity.ok(Map.of("mensaje", "Orden en pruebas", "estado", orden.getEstado()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== TERMINAR (pruebas OK) ====================
    @PutMapping("/{id}/terminar")
    public ResponseEntity<?> terminar(@PathVariable Integer id) {
        try {
            OrdenTrabajo orden = ordenTrabajoService.terminarReparacion(id);
            notificacionService.crearNotificacion(
                "REPARACION",
                "Reparación Terminada",
                "La orden OT-" + id + " está lista. Ya puede pagarse.",
                id
            );
            return ResponseEntity.ok(Map.of("mensaje", "Orden terminada", "estado", orden.getEstado()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== VOLVER A REPARACIÓN (fallas en pruebas) ====================
    @PutMapping("/{id}/volver-reparacion")
    public ResponseEntity<?> volverAReparacion(@PathVariable Integer id) {
        try {
            OrdenTrabajo orden = ordenTrabajoService.volverAReparacion(id);
            return ResponseEntity.ok(Map.of("mensaje", "Vuelto a reparación", "estado", orden.getEstado()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Integer id) {
        try {
            ordenTrabajoService.delete(id);
            return ResponseEntity.ok(Map.of("mensaje", "Orden eliminada exitosamente"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Error al eliminar: " + e.getMessage()));
        }
    }

    @PostMapping("/crear-desde-reporte/{idReporte}")
    public ResponseEntity<?> crearDesdeReporte(@PathVariable Integer idReporte) {
        try {
            OrdenTrabajo orden = ordenTrabajoService.crearDesdeReporte(idReporte);
            notificacionService.crearNotificacion(
                "TICKET",
                "Orden Creada desde Reporte",
                "Se ha creado la orden OT-" + orden.getIdOrden() + " desde el reporte #" + idReporte,
                orden.getIdOrden()
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "mensaje", "Orden creada exitosamente desde reporte",
                "idOrden", orden.getIdOrden()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Error: " + e.getMessage()));
        }
    }

    // ==================== CONVERTIR ORDEN A MAPA ====================
    private Map<String, Object> convertirOrdenAMapa(OrdenTrabajo ot) {
        Map<String, Object> data = new LinkedHashMap<>();

        data.put("idOrden", ot.getIdOrden());
        data.put("estado", ot.getEstado() != null ? ot.getEstado() : "PENDIENTE");
        data.put("fechaInicio", ot.getFechaInicio() != null ? ot.getFechaInicio().toString() : null);
        data.put("fechaFin", ot.getFechaFin() != null ? ot.getFechaFin().toString() : null);
        data.put("fechaAsignacion", ot.getFechaAsignacion() != null ? ot.getFechaAsignacion().toString() : null);
        data.put("puedePagar", ot.getPuedePagar());
        data.put("notasTecnico", ot.getNotasTecnico());

        // Cotización asociada
        List<CotizacionModel> cots = cotizacionRepository.findByIdOrden(ot.getIdOrden());
        if (!cots.isEmpty()) {
            CotizacionModel cot = cots.get(0);
            data.put("idCotizacion", cot.getIdCotizacion());
            data.put("total", cot.getTotal() != null ? cot.getTotal() : BigDecimal.ZERO);
            data.put("totalRepuestos", cot.getTotalRepuestos() != null ? cot.getTotalRepuestos() : BigDecimal.ZERO);
            data.put("manoObra", cot.getManoObra() != null ? cot.getManoObra() : BigDecimal.ZERO);
            data.put("notas", cot.getNotas() != null ? cot.getNotas() : "");
            data.put("estadoCotizacion", cot.getEstado());
        }

        if (ot.getReporte() != null) {
            data.put("idTicket", ot.getReporte().getIdReporte());
            data.put("idReporte", ot.getReporte().getIdReporte());
            data.put("descripcion", ot.getReporte().getDescripcionFalla() != null ? ot.getReporte().getDescripcionFalla() : "");
            data.put("descripcionFalla", ot.getReporte().getDescripcionFalla() != null ? ot.getReporte().getDescripcionFalla() : "");
            data.put("idCliente", ot.getReporte().getIdPersona());
            data.put("idPersona", ot.getReporte().getIdPersona());

            if (ot.getReporte().getPersona() != null) {
                PersonaModel cliente = ot.getReporte().getPersona();
                String nombreCliente = (cliente.getNombre() != null ? cliente.getNombre() : "") + " " +
                                       (cliente.getApellido() != null ? cliente.getApellido() : "");
                data.put("nombreCliente", nombreCliente.trim());
                data.put("cliente", nombreCliente.trim());
            } else {
                String nombreDefault = "Cliente #" + ot.getReporte().getIdPersona();
                data.put("nombreCliente", nombreDefault);
                data.put("cliente", nombreDefault);
            }

            data.put("marca", ot.getReporte().getMarca() != null ? ot.getReporte().getMarca() : "");
            data.put("modelo", ot.getReporte().getModelo() != null ? ot.getReporte().getModelo() : "");
        }

        if (ot.getEquipo() != null) {
            data.put("idEquipo", ot.getEquipo().getIdEquipo());
        }

        if (ot.getTecnico() != null) {
            data.put("idTecnico", ot.getTecnico().getIdPersona());
            if (ot.getTecnico().getPersona() != null) {
                PersonaModel p = ot.getTecnico().getPersona();
                String nombreCompleto = (p.getNombre() != null ? p.getNombre() : "") + " " +
                                       (p.getApellido() != null ? p.getApellido() : "");
                data.put("nombreTecnico", nombreCompleto.trim());
                data.put("tecnico", nombreCompleto.trim());
            }
        }

        // Trabajos y repuestos
        List<ReparacionTrabajoModel> trabajos = reparacionTrabajoRepository.findByOrdenIdOrden(ot.getIdOrden());
        data.put("trabajosRealizados", trabajos.stream()
            .map(ReparacionTrabajoModel::getDescripcion)
            .collect(Collectors.toList()));

        List<ReparacionRepuestoModel> repuestos = reparacionRepuestoRepository.findByOrdenIdOrden(ot.getIdOrden());
        data.put("repuestosUsados", repuestos.stream().map(r -> {
            Map<String, Object> rep = new LinkedHashMap<>();
            rep.put("nombre", r.getNombre());
            rep.put("cantidad", r.getCantidad());
            rep.put("precio", r.getPrecioUnitario());
            return rep;
        }).collect(Collectors.toList()));

        return data;
    }

    private Object getValue(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            if (map.containsKey(key) && map.get(key) != null) {
                return map.get(key);
            }
        }
        return null;
    }

    private String getString(Map<String, Object> map, String... keys) {
        Object value = getValue(map, keys);
        return value != null ? value.toString() : null;
    }

    private LocalDate parseFecha(String fechaStr) {
        if (fechaStr == null || fechaStr.isEmpty()) return LocalDate.now();
        fechaStr = fechaStr.trim();
        if (fechaStr.contains("T")) fechaStr = fechaStr.substring(0, fechaStr.indexOf('T'));
        if (fechaStr.contains(" ")) fechaStr = fechaStr.substring(0, fechaStr.indexOf(' '));

        DateTimeFormatter[] formatters = {
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd")
        };
        for (DateTimeFormatter formatter : formatters) {
            try {
                return LocalDate.parse(fechaStr, formatter);
            } catch (DateTimeParseException e) {}
        }
        return LocalDate.now();
    }
}