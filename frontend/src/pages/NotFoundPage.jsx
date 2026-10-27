import PageHeader from '../components/PageHeader';
import PixelButton from '../components/PixelButton';

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="ERROR 404" subtitle="SECTOR NO ENCONTRADO EN LA RED." />
      <PixelButton to="/">VOLVER AL INICIO</PixelButton>
    </>
  );
}
