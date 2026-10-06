package com.reparaciones.paginaweb.services;

import com.reparaciones.paginaweb.models.*;
import com.reparaciones.paginaweb.repositories.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class OrdenTrabajoService {

    private final OrdenTrabajoRepository ordenTrabajoRepository;
    private final ReporteFallaRepository reporteFallaRepository;
    private final EquipoRepository equipoRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ReparacionTrabajoRepository reparacionTrabajoRepository;
    private final ReparacionRepuestoRepository reparacionRepuestoRepository;

    public OrdenTrabajoService(OrdenTrabajoRepository ordenTrabajoRepository,
                                ReporteFallaRepository reporteFallaRepository,
                                EquipoRepository equipoRepository,
                                TecnicoRepository tecnicoRepository,
                                ReparacionTrabajoRepository reparacionTrabajoRepository,
                                ReparacionRepuestoRepository reparacionRepuestoRepository) {
        this.ordenTrabajoRepository = ordenTrabajoRepository;
        this.reporteFallaRepository = reporteFallaRepository;
        this.equipoRepository = equipoRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.reparacionTrabajoRepository = reparacionTrabajoRepository;
        this.reparacionRepuestoRepository = reparacionRepuestoRepository;
    }

    @Transactional(readOnly = true)
    public List<OrdenTrabajo> findAll() {
        return ordenTrabajoRepository.findAll();
    }

    @Transactional(readOnly = true)
    public OrdenTrabajo findById(Integer id) {
        return ordenTrabajoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Orden no encontrada: " + id));
    }

    @Transactional(readOnly = true)
    public List<OrdenTrabajo> findByEstado(String estado) {
        return ordenTrabajoRepository.findByEstado(estado);
    }

    @Transactional(readOnly = true)
    public List<OrdenTrabajo> findByTecnico(Integer idTecnico) {
        return ordenTrabajoRepository.findByTecnicoIdPersona(idTecnico);
    }

    @Transactional
    public OrdenTrabajo save(OrdenTrabajo orden) {
        if (orden.getFechaInicio() == null) {
            orden.setFechaInicio(LocalDate.now());
        }
        if (orden.getEstado() == null || orden.getEstado().isEmpty()) {
            orden.setEstado("PENDIENTE");
        }
        return ordenTrabajoRepository.save(orden);
    }

    @Transactional
    public OrdenTrabajo update(Integer id, OrdenTrabajo ordenActualizada) {
        OrdenTrabajo ordenExistente = findById(id);

        if (ordenActualizada.getEstado() != null) {
            ordenExistente.setEstado(ordenActualizada.getEstado());
        }
        if (ordenActualizada.getTecnico() != null) {
            ordenExistente.setTecnico(ordenActualizada.getTecnico());
        }
        if (ordenActualizada.getFechaInicio() != null) {
            ordenExistente.setFechaInicio(ordenActualizada.getFechaInicio());
        }
        if (ordenActualizada.getFechaFin() != null) {
            ordenExistente.setFechaFin(ordenActualizada.getFechaFin());
        }
        if (ordenActualizada.getEquipo() != null) {
            ordenExistente.setEquipo(ordenActualizada.getEquipo());
        }
        if (ordenActualizada.getPuedePagar() != null) {
            ordenExistente.setPuedePagar(ordenActualizada.getPuedePagar());
        }
        if (ordenActualizada.getNotasTecnico() != null) {
            ordenExistente.setNotasTecnico(ordenActualizada.getNotasTecnico());
        }

        return ordenTrabajoRepository.save(ordenExistente);
    }

    // ==================== NUEVO: ASIGNAR TÉCNICO ====================
    @Transactional
    public OrdenTrabajo asignarTecnico(Integer idOrden, Integer idTecnico) {
        OrdenTrabajo orden = findById(idOrden);
        TecnicoModel tecnico = tecnicoRepository.findById(idTecnico)
                .orElseThrow(() -> new RuntimeException("Técnico no encontrado: " + idTecnico));
        orden.setTecnico(tecnico);
        orden.setEstado("ASIGNADO");
        orden.setFechaAsignacion(LocalDateTime.now());
        return ordenTrabajoRepository.save(orden);
    }

    // ==================== NUEVO: GUARDAR TRABAJOS Y REPUESTOS ====================
    @Transactional
    public OrdenTrabajo guardarDetallesReparacion(Integer idOrden, List<ReparacionTrabajoModel> trabajos,
                                                    List<ReparacionRepuestoModel> repuestos,
                                                    String notasTecnico) {
        OrdenTrabajo orden = findById(idOrden);

        // Borrar los anteriores
        reparacionTrabajoRepository.deleteByOrdenIdOrden(idOrden);
        reparacionRepuestoRepository.deleteByOrdenIdOrden(idOrden);
        orden.getTrabajosRealizados().clear();
        orden.getRepuestosUsados().clear();

        // Guardar los nuevos
        if (trabajos != null) {
            for (ReparacionTrabajoModel t : trabajos) {
                t.setId(null);
                t.setOrden(orden);
                orden.getTrabajosRealizados().add(t);
            }
        }
        if (repuestos != null) {
            for (ReparacionRepuestoModel r : repuestos) {
                r.setId(null);
                r.setOrden(orden);
                orden.getRepuestosUsados().add(r);
            }
        }
        if (notasTecnico != null) {
            orden.setNotasTecnico(notasTecnico);
        }

        return ordenTrabajoRepository.save(orden);
    }

    // ==================== NUEVO: AVANZAR A PRUEBAS ====================
    @Transactional
    public OrdenTrabajo avanzarAPruebas(Integer idOrden) {
        OrdenTrabajo orden = findById(idOrden);
        orden.setEstado("EN_PRUEBAS");
        return ordenTrabajoRepository.save(orden);
    }

    // ==================== NUEVO: TERMINAR (pruebas OK) ====================
    @Transactional
    public OrdenTrabajo terminarReparacion(Integer idOrden) {
        OrdenTrabajo orden = findById(idOrden);
        orden.setEstado("TERMINADO");
        orden.setPuedePagar(true);
        orden.setFechaFin(LocalDate.now());
        return ordenTrabajoRepository.save(orden);
    }

    // ==================== NUEVO: VOLVER A REPARACIÓN (pruebas con fallas) ====================
    @Transactional
    public OrdenTrabajo volverAReparacion(Integer idOrden) {
        OrdenTrabajo orden = findById(idOrden);
        orden.setEstado("EN_REPARACION");
        return ordenTrabajoRepository.save(orden);
    }

    @Transactional
    public void delete(Integer id) {
        OrdenTrabajo orden = findById(id);
        ordenTrabajoRepository.delete(orden);
    }

    @Transactional(readOnly = true)
    public long count() {
        return ordenTrabajoRepository.count();
    }

    @Transactional(readOnly = true)
    public long countByEstado(String estado) {
        return ordenTrabajoRepository.countByEstado(estado);
    }

    @Transactional
    public OrdenTrabajo crearDesdeReporte(Integer idReporte) {
        ReporteFallaModel reporte = reporteFallaRepository.findById(idReporte)
                .orElseThrow(() -> new RuntimeException("Reporte no encontrado con ID: " + idReporte));

        EquipoModel equipo = new EquipoModel();
        equipo.setMarca(reporte.getMarca());
        equipo.setModelo(reporte.getModelo());
        equipo.setTipo(reporte.getTipoEquipo());
        equipo.setSerie(reporte.getNumeroSerie());
        equipo = equipoRepository.save(equipo);

        OrdenTrabajo orden = new OrdenTrabajo();
        orden.setReporte(reporte);
        orden.setEquipo(equipo);
        orden.setEstado("PENDIENTE");
        orden.setFechaInicio(LocalDate.now());

        return ordenTrabajoRepository.save(orden);
    }
}