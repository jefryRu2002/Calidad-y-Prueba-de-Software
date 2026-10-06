package com.reparaciones.paginaweb.repositories;

import com.reparaciones.paginaweb.models.ReparacionRepuestoModel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReparacionRepuestoRepository extends JpaRepository<ReparacionRepuestoModel, Integer> {
    List<ReparacionRepuestoModel> findByOrdenIdOrden(Integer idOrden);
    void deleteByOrdenIdOrden(Integer idOrden);
}