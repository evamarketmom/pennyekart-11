import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
  order_id: string | null;
}

const CustomerWallet = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [balance, setBalance] = useState(0);
  const [minUsage, setMinUsage] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/customer/login");
      return;
    }
    if (user) fetchWallet();
  }, [user, authLoading]);

  const fetchWallet = async () => {
    setLoading(true);
    // Fetch wallet
    const { data: wallet } = await supabase
      .from("customer_wallets")
      .select("*")
      .eq("customer_user_id", user!.id)
      .maybeSingle();

    if (wallet) {
      setBalance(wallet.balance);
      setMinUsage(wallet.min_usage_amount);

      // Fetch transactions
      const { data: txns } = await supabase
        .from("customer_wallet_transactions")
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false });

      if (txns) setTransactions(txns as Transaction[]);
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">My Wallet</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Balance Card */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="h-6 w-6" />
              <span className="text-sm font-medium opacity-90">Wallet Balance</span>
            </div>
            {loading ? (
              <Skeleton className="h-10 w-32 bg-primary-foreground/20" />
            ) : (
              <p className="text-3xl font-bold">₹{balance.toFixed(2)}</p>
            )}
            {minUsage > 0 && (
              <p className="text-xs mt-2 opacity-80">
                Min. order amount to use wallet: ₹{minUsage.toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Transaction History */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Transaction History</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Wallet className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="font-medium">No transactions yet</p>
                <p className="text-sm mt-1">Your wallet transactions will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {transactions.map(txn => (
                <Card key={txn.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      txn.type === "credit" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                    }`}>
                      {txn.type === "credit" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {txn.description || (txn.type === "credit" ? "Credited" : "Debited")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    </div>
                    <p className={`text-sm font-bold ${txn.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                      {txn.type === "credit" ? "+" : "-"}₹{txn.amount.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerWallet;
