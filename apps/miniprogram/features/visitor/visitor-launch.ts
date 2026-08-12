export const visitorGuestRoute = 'pages/guest/guest';

export function isVisitorGuestLaunch(path: string | undefined): boolean {
  return path === visitorGuestRoute;
}
