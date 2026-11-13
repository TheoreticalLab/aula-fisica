/** Sesión ficticia para el arnés de la calculadora (sustituye a src/auth/AuthContext solo en esta prueba). */
export function useAuth() {
  return { session: { access_token: 'token-de-prueba' }, profile: { role: 'student', active: true } } as never;
}
