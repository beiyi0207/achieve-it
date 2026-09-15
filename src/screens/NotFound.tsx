import { Header } from '../components/Header';

export function NotFoundScreen() {
  return (
    <>
      <Header title="Not found" />
      <div class="container">
        <p class="muted">That page does not exist.</p>
        <p>
          <a href="#/kids">Go to your kids</a>
        </p>
      </div>
    </>
  );
}
