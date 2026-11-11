import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  usuario: string = '';
  contrasena: string = '';
  cargando: boolean = false;
  errorLogin: string = '';
  cuentaCreada: boolean = false;
  cuentaBloqueada: boolean = false;

  mostrarOlvido: boolean = false;
  correoRecuperacion: string = '';
  enviandoCorreo: boolean = false;
  correoEnviado: boolean = false;

  mostrarRegistro: boolean = false;
  dni: string = '';
  nombres: string = '';
  apellidos: string = '';
  correo: string = '';
  telefono: string = '';
  fechaNacimiento: string = '';
  contrasenaRegistro: string = '';
  confirmarContrasena: string = '';
  errorRegistro: string = '';
  buscandoDni: boolean = false;
  registrando: boolean = false;

  private timeoutErrorLogin: any;
  private timeoutErrorRegistro: any;

  private apiUrl = 'http://localhost:8080/api';

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  // ==================== HELPERS DE ERROR ====================
  private mostrarErrorLogin(mensaje: string) {
    if (this.timeoutErrorLogin) clearTimeout(this.timeoutErrorLogin);
    this.errorLogin = mensaje;
    this.cdr.detectChanges();
    this.timeoutErrorLogin = setTimeout(() => {
      this.errorLogin = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  private mostrarErrorRegistro(mensaje: string) {
    if (this.timeoutErrorRegistro) clearTimeout(this.timeoutErrorRegistro);
    this.errorRegistro = mensaje;
    this.cdr.detectChanges();
    this.timeoutErrorRegistro = setTimeout(() => {
      this.errorRegistro = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  // ==================== LÓGICA DE BLOQUEO POR USUARIO ====================
  
  private obtenerIntentos(usuario: string): number {
    const clave = `coltech_intentos_${usuario.toLowerCase().trim()}`;
    return Number(localStorage.getItem(clave) || '0');
  }

  private guardarIntentos(usuario: string, intentos: number) {
    const clave = `coltech_intentos_${usuario.toLowerCase().trim()}`;
    localStorage.setItem(clave, intentos.toString());
  }

  private limpiarIntentos(usuario: string) {
    const clave = `coltech_intentos_${usuario.toLowerCase().trim()}`;
    localStorage.removeItem(clave);
  }

  // ==================== INICIAR SESIÓN ====================
  iniciarSesion() {
    if (!this.usuario || !this.contrasena) {
      this.mostrarErrorLogin('Ingresa usuario y contraseña');
      return;
    }

    const intentosActuales = this.obtenerIntentos(this.usuario);
    if (intentosActuales >= 3) {
      this.activarBloqueoTemporal();
      return;
    }

    this.cargando = true;
    this.errorLogin = '';
    this.cuentaBloqueada = false;
    this.cdr.detectChanges();

    this.http.post(`${this.apiUrl}/auth/login`, {
      usuario: this.usuario.trim(),
      contrasena: this.contrasena
    }).subscribe({
      next: (resp: any) => {
        this.limpiarIntentos(this.usuario);
        this.guardarSesionYRedirigir(resp);
      },
      error: (err) => {
        this.cargando = false;
        this.cdr.detectChanges();
        this.manejarErrorLogin(err);
      }
    });
  }

  private guardarSesionYRedirigir(resp: any) {
    const usuarioData = {
      idPersona: resp.idPersona || '',
      nombre: resp.nombre || '',
      apellido: resp.apellido || '',
      correo: resp.correo || this.usuario,
      telefono: resp.telefono || '',
      dni: resp.dni || '',
      rol: resp.rol?.toUpperCase() || 'CLIENTE'
    };

    localStorage.setItem('usuario', JSON.stringify(usuarioData));
    localStorage.setItem('idPersona', usuarioData.idPersona.toString());
    if (resp.token) localStorage.setItem('token', resp.token);

    this.cargando = false;
    this.cdr.detectChanges();
    this.redirigirPorRol(resp.rol);
  }

  private manejarErrorLogin(err: any) {
    // Si el backend YA envía un código de bloqueo (423)
    if (err.status === 423 || err.error?.error?.toLowerCase().includes('bloqueada')) {
      this.activarBloqueoTemporal();
      return;
    }

    // Credenciales incorrectas (401 / 403)
    if (err.status === 401 || err.status === 403) {
      let intentos = this.obtenerIntentos(this.usuario);
      intentos++;
      this.guardarIntentos(this.usuario, intentos);

      if (intentos >= 3) {
        this.activarBloqueoTemporal();
      } else {
        this.errorLogin = `Credenciales incorrectas. Intento ${intentos} de 3.`;
        this.cdr.detectChanges();
      }
    } else if (err.status === 0) {
      this.errorLogin = 'No se pudo conectar al servidor';
      this.cdr.detectChanges();
    } else {
      this.errorLogin = err.error?.error || 'Error al iniciar sesión';
      this.cdr.detectChanges();
    }
  }

  /**
   * Activa el mensaje de bloqueo, limpia el formulario y después de 5 segundos
   * "refresca" la pantalla para permitir intentar con otra cuenta.
   */
  private activarBloqueoTemporal() {
    // 1. Mostrar el bloqueo y limpiar campos
    this.cuentaBloqueada = true;
    this.usuario = '';
    this.contrasena = '';
    this.errorLogin = '';
    this.cdr.detectChanges();

    // 2. Temporizador para "refrescar" la pantalla
    setTimeout(() => {
      this.cuentaBloqueada = false;
      this.cdr.detectChanges();
    }, 5000); // 5 segundos (puedes cambiarlo a 3000 si quieres que sea más rápido)
  }

  private redirigirPorRol(rol: string) {
    const r = rol?.toUpperCase();
    switch (r) {
      case 'ADMINISTRADOR':
      case 'ADMIN':
        this.router.navigate(['/administrador/dashboard']);
        break;
      case 'TECNICO':
      case 'TÉCNICO':
        this.router.navigate(['/tecnico/ordenes-asignadas']);
        break;
      default:
        this.router.navigate(['/cliente/dashboard']);
        break;
    }
  }

  // ==================== OLVIDO CONTRASEÑA ====================
  abrirOlvido() {
    if (this.timeoutErrorLogin) clearTimeout(this.timeoutErrorLogin);
    if (this.timeoutErrorRegistro) clearTimeout(this.timeoutErrorRegistro);
    this.errorLogin = '';
    this.errorRegistro = '';
    this.mostrarOlvido = true;
    this.correoEnviado = false;
    this.correoRecuperacion = '';
  }

  cerrarOlvido() {
    this.mostrarOlvido = false;
  }

  enviarCorreoRecuperacion() {
    if (!this.correoRecuperacion) return;
    this.enviandoCorreo = true;
    this.cdr.detectChanges();

    this.http.post(`${this.apiUrl}/auth/olvide-contrasena`, {
      correo: this.correoRecuperacion.trim()
    }).subscribe({
      next: () => {
        this.enviandoCorreo = false;
        this.correoEnviado = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.enviandoCorreo = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ==================== REGISTRO ====================
  abrirRegistro() {
    if (this.timeoutErrorRegistro) clearTimeout(this.timeoutErrorRegistro);
    if (this.timeoutErrorLogin) clearTimeout(this.timeoutErrorLogin);
    this.errorRegistro = '';
    this.errorLogin = '';

    this.mostrarRegistro = true;
    this.limpiarFormularioRegistro();
    this.registrando = false;
    this.cdr.detectChanges();
  }

  private limpiarFormularioRegistro() {
    this.dni = '';
    this.nombres = '';
    this.apellidos = '';
    this.correo = '';
    this.telefono = '';
    this.fechaNacimiento = '';
    this.contrasenaRegistro = '';
    this.confirmarContrasena = '';
  }

  cerrarRegistro() {
    if (this.timeoutErrorRegistro) clearTimeout(this.timeoutErrorRegistro);
    this.mostrarRegistro = false;
    this.errorRegistro = '';
    this.registrando = false;
  }

  onDniChange() {
    this.nombres = '';
    this.apellidos = '';
    this.fechaNacimiento = '';
    if (this.dni.length === 8) {
      this.buscarDniReniec();
    }
  }

  buscarDniReniec() {
    if (!this.dni || this.dni.length !== 8) return;
    this.buscandoDni = true;
    this.cdr.detectChanges();

    this.http.get(`${this.apiUrl}/reniec/dni/${this.dni}`).subscribe({
      next: (resp: any) => {
        const data = resp.data || resp;
        if (data) {
          this.nombres = data.nombres || data.nombre || '';
          const paterno = data.apellidoPaterno || data.apellido_paterno || data.paterno || '';
          const materno = data.apellidoMaterno || data.apellido_materno || data.materno || '';
          this.apellidos = (paterno + ' ' + materno).trim() || data.apellidos || data.apellido || '';
          this.fechaNacimiento = data.fechaNacimiento || data.fecha_nacimiento || '';
        }
        this.buscandoDni = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.buscandoDni = false;
        this.cdr.detectChanges();
      }
    });
  }

  soloNumeros(event: any): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
  }

  onDniInput(event: any) {
    const input = event.target as HTMLInputElement;
    const valor = input.value.replace(/\D/g, '').slice(0, 8);
    this.dni = valor;
    input.value = valor;
    this.onDniChange();
  }

  onTelefonoInput(event: any) {
    const input = event.target as HTMLInputElement;
    const valor = input.value.replace(/\D/g, '').slice(0, 9);
    this.telefono = valor;
    input.value = valor;
  }

  // ==================== REGISTRAR ====================
  private validarFormularioRegistro(): string | null {
    if (!this.dni || this.dni.length !== 8) return 'DNI inválido (8 dígitos)';
    if (!this.nombres.trim()) return 'Ingresa tus nombres';
    if (!this.apellidos.trim()) return 'Ingresa tus apellidos';
    if (!this.fechaNacimiento) return 'Debes ingresar tu fecha de nacimiento';
    if (!this.correo?.includes('@')) return 'Correo inválido';
    
    if (!this.telefono || this.telefono.length !== 9 || !/^\d{9}$/.test(this.telefono)) {
      return 'Teléfono inválido (debe tener 9 dígitos)';
    }
    
    if (this.contrasenaRegistro.length < 6) return 'Contraseña muy corta (mín 6)';
    if (this.contrasenaRegistro !== this.confirmarContrasena) return 'Las contraseñas no coinciden';
    
    return null;
  }

  registrarUsuario() {
    this.errorRegistro = '';
    
    const errorValidacion = this.validarFormularioRegistro();
    if (errorValidacion) {
      this.mostrarErrorRegistro(errorValidacion);
      return;
    }

    this.registrando = true;
    this.cdr.detectChanges();

    const body = {
      dni: this.dni.trim(),
      nombre: this.nombres.trim(),
      apellido: this.apellidos.trim(),
      telefono: this.telefono.trim(),
      usuario: this.correo.trim().toLowerCase(),
      contrasena: this.contrasenaRegistro,
      fechaNacimiento: this.fechaNacimiento
    };

    this.http.post(`${this.apiUrl}/auth/register`, body).subscribe({
      next: (resp: any) => {
        this.registrando = false;
        this.cerrarRegistro();
        this.cuentaCreada = true;
        this.usuario = this.correo.trim().toLowerCase();
        this.cdr.detectChanges();

        setTimeout(() => {
          this.cuentaCreada = false;
          this.cdr.detectChanges();
        }, 5000);
      },
      error: (err) => {
        this.registrando = false;
        this.manejarErrorRegistro(err);
      }
    });
  }

  private manejarErrorRegistro(err: any) {
    switch (err.status) {
      case 409:
        this.mostrarErrorRegistro(err.error?.error || 'El correo ya está registrado');
        break;
      case 400:
        this.mostrarErrorRegistro(err.error?.error || 'Datos inválidos');
        break;
      case 0:
        this.mostrarErrorRegistro('No se pudo conectar al servidor');
        break;
      default:
        this.mostrarErrorRegistro(err.error?.error || 'Error al crear la cuenta');
        break;
    }
  }
}