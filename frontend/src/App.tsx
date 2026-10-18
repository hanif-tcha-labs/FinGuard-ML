import { lazy, Suspense, useState } from "react";
import { Toaster } from "sonner";
import { Layout, type PageId } from "./components/Layout";
import { Skeleton } from "./components/ui";

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const Analysis = lazy(() =>
  import("./pages/Analysis").then((module) => ({ default: module.Analysis })),
);
const Batch = lazy(() =>
  import("./pages/Batch").then((module) => ({ default: module.Batch })),
);
const History = lazy(() =>
  import("./pages/History").then((module) => ({ default: module.History })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((module) => ({ default: module.Settings })),
);

export default function App() {
  const [page, setPage] = useState<PageId>("dashboard");
  return (
    <>
      <Layout active={page} onNavigate={setPage}>
        <Suspense fallback={<div className="page-loading"><Skeleton /><Skeleton /><Skeleton /></div>}>
          {page === "dashboard" && <Dashboard onNavigate={setPage} />}
          {page === "analysis" && <Analysis />}
          {page === "batch" && <Batch />}
          {page === "history" && <History />}
          {page === "settings" && <Settings />}
        </Suspense>
      </Layout>
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </>
  );
}
