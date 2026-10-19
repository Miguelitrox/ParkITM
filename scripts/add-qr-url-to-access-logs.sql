-- Guarda la URL del QR (credencial digital) de cada acceso
alter table public.access_logs add column if not exists qr_url text;

-- Registros antiguos: la URL del QR se guardo en control_number
update public.access_logs
set qr_url = control_number
where qr_url is null and control_number like 'http%';
