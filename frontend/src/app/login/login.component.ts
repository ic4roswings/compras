import { Component, OnInit } from '@angular/core';

import { ReactiveFormsModule, FormsModule, UntypedFormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LoginService } from '../service/login.service';
import { RsaService } from '../service/rsa.service';
import { Router } from '@angular/router';
import { tokenRefreshI } from '../interface/tokenRefresh.interface';
import { AppState } from '../interface/app-state';
import { Observable } from 'rxjs';
import { GlobalService } from '../service/global.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterModule]
})
export class LoginComponent implements OnInit {

  rsaHelper = new RsaService
  appState$: Observable<AppState<tokenRefreshI>>
  errorStatus: boolean = false
  errorMsj: any = '';

  loginForm = new UntypedFormGroup({
    username: new UntypedFormControl('', Validators.required),
    password: new UntypedFormControl('', Validators.required)
  })
  constructor(private login: LoginService, private router: Router, private global: GlobalService) { }

  ngOnInit(): void {
    this.global.checkTokens('productos')
  }

  onLogin(form) {
    form.password = this.rsaHelper.encryptWithPublicKey(form.password)
    this.login.onLogin(form).subscribe(data => {
      if (data.status == 'Ok') {
        localStorage.setItem('token', data.access)
        localStorage.setItem('refresh', data.refresh)
        if (form.username == 'ferromex_test') {
          this.router.navigate(['home'])
        } else {
          this.router.navigate(['productos'])
        }
      } else {
        this.errorStatus = true
        this.errorMsj = data.error

      }
    })

  }
}
