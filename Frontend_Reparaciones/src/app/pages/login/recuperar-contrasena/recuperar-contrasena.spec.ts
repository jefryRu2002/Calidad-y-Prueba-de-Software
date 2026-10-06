import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { RecuperarContrasena } from './recuperar-contrasena';

describe('RecuperarContrasena', () => {
  let component: RecuperarContrasena;
  let fixture: ComponentFixture<RecuperarContrasena>;

  // 🔹 Mocks de los servicios que inyecta el componente
  const mockActivatedRoute = {
    snapshot: {
      queryParams: { token: 'token-de-prueba' }
    }
  };

  const mockRouter = {
    navigate: () => Promise.resolve(true)
  };

  const mockHttpClient = {
    post: () => of({})
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecuperarContrasena],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: HttpClient, useValue: mockHttpClient }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RecuperarContrasena);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('debe leer el token desde queryParams', () => {
    expect(component.token).toBe('token-de-prueba');
  });

  it('debe mostrar alerta si las contraseñas no coinciden', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    component.contrasena = 'abc';
    component.confirmar = 'xyz';
    component.restablecer();
    expect(alertSpy).toHaveBeenCalledWith('Las contraseñas no coinciden');
  });
});