package com.reparaciones.paginaweb.repositories;

import com.reparaciones.paginaweb.models.ReparacionTrabajoModel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReparacionTrabajoRepository extends JpaRepository<ReparacionTrabajoModel, Integer> {
    List<ReparacionTrabajoModel> findByOrdenIdOrden(Integer idOrden);
    void deleteByOrdenIdOrden(Integer idOrden);
}