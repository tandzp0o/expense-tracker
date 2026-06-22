import React, { useEffect, useMemo, useState } from "react";
import { Bot, Play, RefreshCw } from "lucide-react";
import { auth } from "lib/firebase/config";
import { aiApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { PageHeader } from "components/app/page-header";
import { Button } from "components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Select } from "components/ui/select";
import { Spinner } from "components/ui/spinner";

type AiUser = {
  uid: string;
  email: string;
  displayName?: string;
  totalIncome?: number;
  totalExpense?: number;
};

const AIModel: React.FC = () => {
  const { isVietnamese } = useLocale();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [runningRecommend, setRunningRecommend] = useState(false);
  const [users, setUsers] = useState<AiUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [recommendation, setRecommendation] = useState<any>(null);

  const copy = useMemo(
    () =>
      isVietnamese
        ? {
            title: "AI Model",
            desc: "Huấn luyện model và chạy gợi ý theo từng user từ dữ liệu mới nhất.",
            train: "Train model",
            trainRunning: "Đang train...",
            runRecommend: "Chạy gợi ý",
            runRecommendRunning: "Đang chạy...",
            refresh: "Làm mới",
            selectUser: "Chọn user",
            status: "Trạng thái model",
            users: "Danh sách user",
            recommendation: "Kết quả gợi ý",
          }
        : {
            title: "AI Model",
            desc: "Train model and run recommendation for selected users.",
            train: "Train model",
            trainRunning: "Training...",
            runRecommend: "Run recommendation",
            runRecommendRunning: "Running...",
            refresh: "Refresh",
            selectUser: "Select user",
            status: "Model status",
            users: "Users",
            recommendation: "Recommendation result",
          },
    [isVietnamese],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const [statusRes, usersRes] = await Promise.all([
        aiApi.getStatus(token),
        aiApi.getUsers(token),
      ]);
      setStatus(statusRes?.data || null);
      const list = usersRes?.data || [];
      setUsers(list);
      setSelectedUserId((current) => current || list[0]?.uid || "");
    } catch (error: any) {
      toast({
        title: "AI",
        description: error.message || "Failed to load AI data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrain = async () => {
    setTraining(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await aiApi.train(token);
      toast({
        title: "AI",
        description: isVietnamese
          ? "Train model thành công."
          : "Model training completed.",
        variant: "success",
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: "AI",
        description: error.message || "Training failed",
        variant: "destructive",
      });
    } finally {
      setTraining(false);
    }
  };

  const handleRecommend = async () => {
    if (!selectedUserId) return;
    setRunningRecommend(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const response = await aiApi.recommend(selectedUserId, token);
      setRecommendation(response?.data?.recommendation || null);
      toast({
        title: "AI",
        description: isVietnamese
          ? "Đã chạy gợi ý cho user."
          : "Recommendation generated.",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "AI",
        description: error.message || "Recommendation failed",
        variant: "destructive",
      });
    } finally {
      setRunningRecommend(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.desc}
        actions={
          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="h-4 w-4" />
              {copy.refresh}
            </Button>
            <Button onClick={handleTrain} disabled={training || status?.isTraining}>
              <Bot className="h-4 w-4" />
              {training || status?.isTraining ? copy.trainRunning : copy.train}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{copy.status}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            {isVietnamese ? "Đang train: " : "Training: "}
            <strong>{String(status?.isTraining ?? false)}</strong>
          </p>
          <p>
            {isVietnamese ? "Lần train gần nhất: " : "Last trained at: "}
            <strong>{status?.lastTrainAt || "-"}</strong>
          </p>
          <p>
            {isVietnamese ? "Có artifacts: " : "Has artifacts: "}
            <strong>{String(status?.hasArtifacts ?? false)}</strong>
          </p>
          {status?.lastTrainError ? (
            <p className="text-rose-600">
              {isVietnamese ? "Lỗi train: " : "Train error: "}
              {status.lastTrainError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.users}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            <option value="">{copy.selectUser}</option>
            {users.map((user) => (
              <option key={user.uid} value={user.uid}>
                {(user.displayName || user.email || user.uid) + ` (${user.uid})`}
              </option>
            ))}
          </Select>
          <Button
            onClick={handleRecommend}
            disabled={!selectedUserId || runningRecommend}
          >
            <Play className="h-4 w-4" />
            {runningRecommend ? copy.runRecommendRunning : copy.runRecommend}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.recommendation}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[480px] overflow-auto rounded-md bg-muted p-3 text-xs leading-5">
            {recommendation
              ? JSON.stringify(recommendation, null, 2)
              : isVietnamese
                ? "Chưa có kết quả. Chọn user và bấm chạy gợi ý."
                : "No output yet. Select a user and run recommendation."}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIModel;

