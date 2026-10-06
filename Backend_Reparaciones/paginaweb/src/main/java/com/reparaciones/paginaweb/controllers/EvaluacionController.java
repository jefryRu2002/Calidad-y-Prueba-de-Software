package com.reparaciones.paginaweb.controllers;

import com.reparaciones.paginaweb.models.EvaluacionModel;
import com.reparaciones.paginaweb.models.OrdenTrabajo;
import com.reparaciones.paginaweb.repositories.EvaluacionRepository;
import com.reparaciones.paginaweb.repositories.OrdenTrabajoRepository;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/evaluaciones")
@CrossOrigin(origins = "*")
public class EvaluacionController {

    private final EvaluacionRepository evaluacionRepository;
    private final OrdenTrabajoRepository ordenTrabajoRepository;

    public EvaluacionController(EvaluacionRepository evaluacionRepository,
                                 OrdenTrabajoRepository ordenTrabajoRepository) {
        this.evaluacionRepository = evaluacionRepository;
        this.ordenTrabajoRepository = ordenTrabajoRepository;
    }

    @PostMapping
    public ResponseEntity<?> crearEvaluacion(@RequestBody Map<String, Object> datos) {
        try {
            EvaluacionModel evaluacion = new EvaluacionModel();
            Integer idOrden = Integer.parseInt(datos.get("orden_trabajo_id").toString());

            evaluacion.setOrdenTrabajoId(idOrden);
            evaluacion.setTecnicoId(Integer.parseInt(datos.get("tecnico_id").toString()));
            evaluacion.setProcesador(datos.get("procesador") != null ? datos.get("procesador").toString() : "");
            evaluacion.setRam(datos.get("ram") != null ? datos.get("ram").toString() : "");
            evaluacion.setAlmacenamiento(datos.get("almacenamiento") != null ? datos.get("almacenamiento").toString() : "");
            evaluacion.setSistemaOperativo(datos.get("sistema_operativo") != null ? datos.get("sistema_operativo").toString() : "");
            evaluacion.setDetallesRevision(datos.get("detalles_revision").toString());
            evaluacion.setFechaEvaluacion(LocalDateTime.now());

            EvaluacionModel saved = evaluacionRepository.save(evaluacion);

            // 🔥 CAMBIO CLAVE: Mover la orden a EN_PROCESO
            OrdenTrabajo orden = ordenTrabajoRepository.findById(idOrden).orElse(null);
            if (orden != null) {
                orden.setEstado("EN_PROCESO");
                ordenTrabajoRepository.save(orden);
            }

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "mensaje", "Evaluación guardada",
                "id", saved.getId(),
                "estadoOrden", "EN_PROCESO"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<EvaluacionModel>> findAll() {
        return ResponseEntity.ok(evaluacionRepository.findAll());
    }

    @GetMapping("/orden/{idOrden}")
    public ResponseEntity<?> findByOrden(@PathVariable Integer idOrden) {
        return ResponseEntity.ok(evaluacionRepository.findByOrdenTrabajoId(idOrden));
    }

    @GetMapping("/tecnico/{idTecnico}")
    public ResponseEntity<?> findByTecnico(@PathVariable Integer idTecnico) {
        return ResponseEntity.ok(evaluacionRepository.findByTecnicoId(idTecnico));
    }
}