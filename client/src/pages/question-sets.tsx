import { useQuery } from "@tanstack/react-query";
import { FileQuestion, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LanguageBadge } from "@/components/language-badge";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import type { QuestionSet, Question } from "@/lib/types";
import { useState } from "react";

const riskTagColors: Record<string, string> = {
  deadline: "bg-destructive/15 text-destructive border-destructive/30",
  eligibility: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  location: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  contact: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  docs: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  fees: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  hours: "bg-primary/15 text-primary border-primary/30",
  general: "bg-muted text-muted-foreground border-border",
};

export default function QuestionSets() {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [activeLang, setActiveLang] = useState<"all" | "fr" | "nl">("all");

  const { data: questionSets, isLoading: setsLoading } = useQuery<QuestionSet[]>(
    {
      queryKey: ["/api/question-sets"],
    }
  );

  const { data: questions, isLoading: questionsLoading } = useQuery<Question[]>(
    {
      queryKey: ["/api/questions"],
    }
  );

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedSets);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSets(newExpanded);
  };

  if (setsLoading || questionsLoading) {
    return <LoadingState message="Loading question sets..." />;
  }

  if (!questionSets || questionSets.length === 0) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="No question sets"
        description="Question sets will be loaded from seed data on startup."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Question Sets</h1>
        <p className="text-muted-foreground">
          View and manage audit question sets
        </p>
      </div>

      <Tabs
        value={activeLang}
        onValueChange={(value) => {
          const nextLang = value as "all" | "fr" | "nl";
          setActiveLang(nextLang);

          if (nextLang === "all") {
            setExpandedSets(new Set());
          } else {
            setExpandedSets(new Set(questionSets?.map((qs) => qs.id) || []));
          }
        }}
        className="w-full"
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="fr">FR</TabsTrigger>
          <TabsTrigger value="nl">NL</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {questionSets.map((qs) => {
          const setQuestions = questions?.filter(
            (q) => q.questionSetId === qs.id
          );
          const isExpanded = expandedSets.has(qs.id);

          const questionsByLang = setQuestions?.reduce(
            (acc, q) => {
              if (!acc[q.lang]) acc[q.lang] = [];
              acc[q.lang].push(q);
              return acc;
            },
            {} as Record<string, Question[]>
          );

          const visibleLangs = qs.languages.filter(
            (lang) => activeLang === "all" || lang === activeLang
          );

          return (
            <Card key={qs.id} data-testid={`question-set-${qs.id}`}>
              <Collapsible
                open={isExpanded}
                onOpenChange={() => toggleExpanded(qs.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover-elevate">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{qs.title}</CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Version {qs.version} • {setQuestions?.length || 0} questions
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {activeLang === "all" ? (
                              <>
                                {setQuestions?.filter((q) => activeLang === "all" || q.lang === activeLang).length || 0} questions · {setQuestions?.filter((q) => q.lang === "fr").length || 0} FR · {setQuestions?.filter((q) => q.lang === "nl").length || 0} NL
                              </>
                            ) : activeLang === "fr" ? (
                              <>{setQuestions?.filter((q) => q.lang === "fr").length || 0} FR questions</>
                            ) : (
                              <>{setQuestions?.filter((q) => q.lang === "nl").length || 0} NL questions</>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                    {qs.topics.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 pl-7">
                        {qs.topics.map((topic) => (
                          <Badge key={topic} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="border-t pt-4">
                    {visibleLangs.map((lang) => {
                      const langQuestions = questionsByLang?.[lang] || [];
                      if (langQuestions.length === 0) return null;

                      return (
                        <div key={lang} className="mb-6 last:mb-0">
                          <div className="mb-3 flex items-center gap-2">
                            <LanguageBadge lang={lang} />
                            <span className="text-sm text-muted-foreground">
                              {langQuestions.length} questions
                            </span>
                          </div>
                          <div className="space-y-2">
                            {langQuestions.map((question, idx) => (
                              <div
                                key={question.id}
                                className="rounded-md border p-3"
                                data-testid={`question-${question.id}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="mb-1 flex items-center gap-2">
                                      <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-medium">
                                        {idx + 1}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={riskTagColors[question.riskTag]}
                                      >
                                        {question.riskTag}
                                      </Badge>
                                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                        {question.topic}
                                      </span>
                                    </div>
                                    <p className="text-sm">{question.text}</p>
                                  </div>
                                </div>
                                {question.expectedFactKeys.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    <span className="text-xs text-muted-foreground">
                                      Expected facts:
                                    </span>
                                    {question.expectedFactKeys.map((key) => (
                                      <span
                                        key={key}
                                        className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary"
                                      >
                                        {key}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
