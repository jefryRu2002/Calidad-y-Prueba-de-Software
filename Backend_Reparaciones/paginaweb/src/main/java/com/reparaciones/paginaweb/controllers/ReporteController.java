package com.reparaciones.paginaweb.controllers;

import com.reparaciones.paginaweb.models.ReporteFallaModel;
import com.reparaciones.paginaweb.services.ReporteFallaService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/reportes")
@CrossOrigin(origins = "*")
public class ReporteController {

    private final ReporteFallaService reporteFallaService;

    public ReporteController(ReporteFallaService reporteFallaService) {
        this.reporteFallaService = reporteFallaService;
    }

    @PostMapping
    public ResponseEntity<?> crearReporte(@RequestBody Map<String, Object> datos) {
        try {
            ReporteFallaModel reporte = new ReporteFallaModel();
            reporte.setMarca((String) datos.get("marca"));
            reporte.setModelo((String) datos.get("modelo"));
            reporte.setTipoEquipo((String) datos.get("tipoEquipo"));
            reporte.setNumeroSerie((String) datos.get("numeroSerie"));
            reporte.setDescripcionFalla((String) datos.get("descripcionFalla"));

            Object idCliente = datos.get("idCliente");
            if (idCliente != null && !idCliente.toString().isEmpty()) {
                reporte.setIdPersona(Integer.parseInt(idCliente.toString()));
            }

            ReporteFallaModel guardado = reporteFallaService.guardarReporte(reporte);

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje", "Reporte creado exitosamente");
            response.put("idReporte", guardado.getIdReporte());

            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Error desconocido"));
        }
    }

    @GetMapping
    public ResponseEntity<?> obtenerTodos() {
        return ResponseEntity.ok(reporteFallaService.obtenerTodos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> obtenerPorId(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(reporteFallaService.obtenerPorId(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Reporte no encontrado"));
        }
    }
}