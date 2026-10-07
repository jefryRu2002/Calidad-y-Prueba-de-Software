import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Login } from './login';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

describe('Login - Pruebas unitarias', () => {
  let component: Login;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ==================== 1. validarDni() ====================
  describe('validarDni()', () => {
    it('debe aceptar un DNI de 8 dígitos (NORMAL)', () => {
      component.dni = '12345678';
      expect(component.validarDni()).toBe(true);
    });

    it('debe rechazar un DNI de  7 dígitos (BORDE)', () => {
      component.dni = '1234567';
      expect(component.validarDni()).toBe(false);
    });

    it('debe rechazar un DNI vacío (EXCEPCIÓN)', () => {
      component.dni = '';
      expect(component.validarDni()).toBe(false);
    });
  });

  // ==================== 2. validarNombres() ====================
  describe('validarNombres()', () => {
    it('debe aceptar nombres válidos (NORMAL)', () => {
      component.nombres = 'Juan Carlos';
      expect(component.validarNombres()).toBe(true);
    });

    it('debe aceptar un nombre de 1 letra (BORDE)', () => {
      component.nombres = 'A';
      expect(component.validarNombres()).toBe(true);
    });

    it('debe rechazar nombres vacíos (EXCEPCIÓN)', () => {
      component.nombres = '';
      expect(component.validarNombres()).toBe(false);
    });
  });

  // ==================== 3. validarApellidos() ====================
  describe('validarApellidos()', () => {
    it('debe aceptar apellidos válidos (NORMAL)', () => {
      component.apellidos = 'Pérez Gómez';
      expect(component.validarApellidos()).toBe(true);
    });

    it('debe aceptar un apellido de 1 letra (BORDE)', () => {
      component.apellidos = 'B';
      expect(component.validarApellidos()).toBe(true);
    });

    it('debe rechazar apellidos vacíos (EXCEPCIÓN)', () => {
      component.apellidos = '';
      expect(component.validarApellidos()).toBe(false);
    });
  });

  // ==================== 4. validarCorreo() ====================
  describe('validarCorreo()', () => {
    it('debe aceptar un correo válido (NORMAL)', () => {
      component.correo = 'juan@test.com';
      expect(component.validarCorreo()).toBe(true);
    });

    it('debe aceptar un correo mínimo con @ (BORDE)', () => {
      component.correo = 'a@b';
      expect(component.validarCorreo()).toBe(true);
    });

    it('debe rechazar un correo sin @ (EXCEPCIÓN)', () => {
      component.correo = 'juantest.com';
      expect(component.validarCorreo()).toBe(false);
    });
  });

  // ==================== 5. validarTelefono() ====================
  describe('validarTelefono()', () => {
    it('debe aceptar un teléfono de 9 dígitos (NORMAL)', () => {
      component.telefono = '987654321';
      expect(component.validarTelefono()).toBe(true);
    });

    it('debe rechazar un teléfono de 8 dígitos (BORDE)', () => {
      component.telefono = '98765432';
      expect(component.validarTelefono()).toBe(false);
    });

    it('debe rechazar un teléfono vacío (EXCEPCIÓN)', () => {
      component.telefono = '';
      expect(component.validarTelefono()).toBe(false);
    });
  });

  // ==================== 6. validarFechaNacimiento() ====================
  describe('validarFechaNacimiento()', () => {
    it('debe aceptar una fecha válida (NORMAL)', () => {
      component.fechaNacimiento = '2000-01-01';
      expect(component.validarFechaNacimiento()).toBe(true);
    });

    it('debe aceptar una fecha límite antigua (BORDE)', () => {
      component.fechaNacimiento = '1900-01-01';
      expect(component.validarFechaNacimiento()).toBe(true);
    });

    it('debe rechazar una fecha vacía (EXCEPCIÓN)', () => {
      component.fechaNacimiento = '';
      expect(component.validarFechaNacimiento()).toBe(false);
    });
  });

  // ==================== 7. validarContrasena() ====================
  describe('validarContrasena()', () => {
    it('debe aceptar una contraseña de 8 caracteres (NORMAL)', () => {
      component.contrasenaRegistro = 'clave123';
      expect(component.validarContrasena()).toBe(true);
    });

    it('debe aceptar una contraseña de 6 caracteres (BORDE)', () => {
      component.contrasenaRegistro = 'clave1';
      expect(component.validarContrasena()).toBe(true);
    });

    it('debe rechazar una contraseña de 5 caracteres (EXCEPCIÓN)', () => {
      component.contrasenaRegistro = 'clave';
      expect(component.validarContrasena()).toBe(false);
    });
  });

  // ==================== 8. validarConfirmacion() ====================
  describe('validarConfirmacion()', () => {
    it('debe aceptar contraseñas iguales (NORMAL)', () => {
      component.contrasenaRegistro = 'clave123';
      component.confirmarContrasena = 'clave123';
      expect(component.validarConfirmacion()).toBe(true);
    });

    it('debe rechazar contraseñas con diferencia mínima (BORDE)', () => {
      component.contrasenaRegistro = 'clave123';
      component.confirmarContrasena = 'clave1234';
      expect(component.validarConfirmacion()).toBe(false);
    });

    it('debe rechazar una confirmación vacía (EXCEPCIÓN)', () => {
      component.contrasenaRegistro = 'clave123';
      component.confirmarContrasena = '';
      expect(component.validarConfirmacion()).toBe(false);
    });
  });
});
  
