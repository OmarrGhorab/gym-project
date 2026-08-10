"use client";

import * as React from "react";
import { useActionState } from "react";

import { PackageCheck, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormDatePicker, FormSelect, FormTimePicker } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createPlan, createPlanCategoryAction, type PlanFormState, updatePlan } from "./actions";
import type { PlanCategoryOption, PlanEmployeeOption, PlanRow } from "./data";
import { PlanTypeField } from "./plan-type-field";
import type { PlanType } from "./plan-types";

const initialPlanFormState: PlanFormState = {
  ok: false,
  errors: {},
  values: {},
};

type PlanFormProps = {
  availablePlans?: PlanRow[];
  categories?: PlanCategoryOption[];
  employees: PlanEmployeeOption[];
  mode?: "create" | "edit";
  onSuccess?: () => void;
  plan?: PlanRow;
};

type PlanEmployeeCommissionDraft = {
  _key: string;
  calculation_type: "fixed" | "percentage";
  employee_id: string;
  id: number;
  is_active: boolean;
  value: string;
};

type PlanCategoryScope = "gym_access" | "extra_service" | "fitness_studio";

/** Opening hours a new plan starts with, so the usual case needs no typing. */
const DEFAULT_ACCESS_STARTS_AT = "09:00";
const DEFAULT_ACCESS_ENDS_AT = "23:59";

function isPlanEmployeeCommissionDraft(value: unknown): value is Partial<PlanEmployeeCommissionDraft> {
  return typeof value === "object" && value !== null;
}

function normalizeCommissionType(value: unknown): "fixed" | "percentage" {
  return value === "percentage" ? "percentage" : "fixed";
}

function normalizeEmployeeRule(value: unknown, index: number): PlanEmployeeCommissionDraft | null {
  if (!isPlanEmployeeCommissionDraft(value)) {
    return null;
  }

  const employeeId =
    typeof value.employee_id === "string" || typeof value.employee_id === "number" ? String(value.employee_id) : "";

  return {
    _key:
      typeof value._key === "string" && value._key.length > 0
        ? value._key
        : `parsed-${index}-${typeof value.id === "number" ? value.id : "new"}`,
    calculation_type: normalizeCommissionType(value.calculation_type),
    employee_id: employeeId,
    id: typeof value.id === "number" ? value.id : 0,
    is_active: value.is_active !== false,
    value: typeof value.value === "string" || typeof value.value === "number" ? String(value.value) : "0",
  };
}

export function PlanCreateForm({
  availablePlans = [],
  categories = [],
  employees,
  mode = "create",
  onSuccess,
  plan,
}: PlanFormProps) {
  const t = useTranslations("Dashboard.plans");
  const formRef = React.useRef<HTMLFormElement>(null);
  const lastHandledStateRef = React.useRef<PlanFormState | null>(null);
  const [state, action, pending] = useActionState(mode === "edit" ? updatePlan : createPlan, initialPlanFormState);

  const [localCategories, setLocalCategories] = React.useState<PlanCategoryOption[]>(categories);
  const [newCatOpen, setNewCatOpen] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState("");
  const [newCatDesc, setNewCatDesc] = React.useState("");
  const [newCatType, setNewCatType] = React.useState<PlanType>("membership");
  const [isCreatingCat, setIsCreatingCat] = React.useState(false);

  React.useEffect(() => {
    if (categories && categories.length > 0) {
      setLocalCategories(categories);
    }
  }, [categories]);

  const categoryScopeByValue = React.useMemo(
    () => new Map<string, PlanCategoryScope>(localCategories.map((category) => [category.slug, category.plan_scope])),
    [localCategories],
  );
  const defaultMembershipCategory = React.useMemo(
    () => localCategories.find((category) => category.is_active && category.plan_type === "membership")?.slug ?? "",
    [localCategories],
  );

  async function handleCreateCategory() {
    if (!newCatName.trim()) {
      toast.error(t("categoryNameRequired"));
      return;
    }

    setIsCreatingCat(true);
    const result = await createPlanCategoryAction(newCatName.trim(), newCatType, newCatDesc.trim() || undefined);
    setIsCreatingCat(false);

    if (result.ok && result.data) {
      toast.success(t("categoryCreated", { name: result.data.name }));
      setLocalCategories((prev) => [...prev, result.data]);
      setCategory(result.data.slug);

      // If the new category belongs to a different type, follow it — otherwise the
      // picker would immediately hide what was just added.
      if (result.data.plan_type !== planType) {
        setPlanType(result.data.plan_type);
      }

      setNewCatName("");
      setNewCatDesc("");
      setNewCatOpen(false);
    } else {
      toast.error(result.error || t("categoryCreateFailed"));
    }
  }

  const initialUnlimitedSessions = state.values.is_unlimited_sessions
    ? state.values.is_unlimited_sessions === "on"
    : Boolean(plan?.is_unlimited_sessions);
  const initialFreezeRequiresApproval = state.values.freeze_requires_approval
    ? state.values.freeze_requires_approval === "on"
    : Boolean(plan?.freeze_requires_approval);
  const initialPlanType = state.values.type || valueOrPlan(state, plan, "type") || "membership";
  const initialCategory = state.values.category || valueOrPlan(state, plan, "category") || defaultMembershipCategory;
  const initialDurationBasis = state.values.duration_basis || (plan?.duration_months ? "months" : "days");
  const initialDurationMonths = state.values.duration_months || valueOrPlan(state, plan, "duration_months") || "1";
  const initialValidFrom = state.values.valid_from || valueOrPlan(state, plan, "valid_from");
  const initialValidTo = state.values.valid_to || valueOrPlan(state, plan, "valid_to");
  const initialDurationDays = state.values.duration_days || valueOrPlan(state, plan, "duration_days") || "30";
  // A new plan starts with the freeze allowance opened up to the full plan length;
  // an existing one keeps whatever it was saved with.
  const maxFreezeWasChosen = Boolean(state.values.max_freeze_days) || mode === "edit";
  const initialMaxFreezeDays = maxFreezeWasChosen
    ? state.values.max_freeze_days || valueOrPlan(state, plan, "max_freeze_days") || "0"
    : initialDurationDays;
  const initialMinFreezeDays = state.values.min_freeze_days || valueOrPlan(state, plan, "min_freeze_days") || "0";
  const initialAccessStartsAt = accessWindowDefault(state, plan, mode, "access_starts_at");
  const initialAccessEndsAt = accessWindowDefault(state, plan, mode, "access_ends_at");
  // An access window is opt-in: a plan with no hours saved lets members in whenever
  // the gym is open, so the pickers stay hidden until the admin asks for a window.
  const initialRestrictAccessHours =
    state.values.restrict_access_hours !== undefined
      ? state.values.restrict_access_hours === "on"
      : mode === "edit" && Boolean(plan?.access_starts_at ?? plan?.access_ends_at);
  const [planType, setPlanType] = React.useState(initialPlanType);
  const [category, setCategory] = React.useState(initialCategory);
  const [unlimitedSessions, setUnlimitedSessions] = React.useState(initialUnlimitedSessions);
  const [freezeRequiresApproval, setFreezeRequiresApproval] = React.useState(initialFreezeRequiresApproval);
  const [restrictAccessHours, setRestrictAccessHours] = React.useState(initialRestrictAccessHours);
  const [durationBasis, setDurationBasis] = React.useState(initialDurationBasis);
  const [durationMonths, setDurationMonths] = React.useState(initialDurationMonths);
  const [validFrom, setValidFrom] = React.useState(initialValidFrom);
  const [validTo, setValidTo] = React.useState(initialValidTo);
  const [durationDays, setDurationDays] = React.useState(initialDurationDays);
  const [maxFreezeDays, setMaxFreezeDays] = React.useState(initialMaxFreezeDays);
  // Until the admin edits it themselves, max freeze follows the plan length.
  const [maxFreezeTouched, setMaxFreezeTouched] = React.useState(maxFreezeWasChosen);
  const [minFreezeDays, setMinFreezeDays] = React.useState(initialMinFreezeDays);
  const [planPrice, setPlanPrice] = React.useState(valueOrPlan(state, plan, "price") || "0");
  const [packageAddons, setPackageAddons] = React.useState(
    plan?.package_addons?.map((item, index) => ({
      _key: `package-${item.plan_id}-${index}`,
      coach_id: String(item.coach_id),
      plan_id: String(item.plan_id),
    })) ?? [],
  );
  const initialEmployeeRules = React.useMemo(
    () => readInitialEmployeeRules(state.values.employee_commission_rules, employees, plan?.id),
    [employees, plan?.id, state.values.employee_commission_rules],
  );
  const [employeeRules, setEmployeeRules] = React.useState<PlanEmployeeCommissionDraft[]>(initialEmployeeRules);
  const planPriceNumber = Math.max(0, Number(planPrice || 0));
  // The coaches listed here are alternatives, not co-earners: a member picks one
  // coach at checkout and CalculateCommission pays only that subscription's coach.
  // So a sale costs one coach's rate — summing every rule made two coaches at 50%
  // read as 100% commission and zero gym net.
  const coachCommissionAmounts = React.useMemo(
    () => employeeRules.filter((rule) => rule.is_active).map((rule) => commissionAmount(rule, planPriceNumber)),
    [employeeRules, planPriceNumber],
  );
  const lowestCoachCommission = coachCommissionAmounts.length > 0 ? Math.min(...coachCommissionAmounts) : 0;
  const highestCoachCommission = coachCommissionAmounts.length > 0 ? Math.max(...coachCommissionAmounts) : 0;
  // Sub-cent spread is rounding noise, not a real difference in what coaches earn.
  const coachCommissionVaries = highestCoachCommission - lowestCoachCommission >= 0.005;
  // Worst case for the gym is the most expensive coach the member could pick.
  const gymNetBeforeExpenses = Math.max(0, planPriceNumber - highestCoachCommission);
  const gymNetBestCase = Math.max(0, planPriceNumber - lowestCoachCommission);
  const selectedCategoryScope = categoryScopeByValue.get(category) ?? "extra_service";

  // Only categories the admin marked as valid for the selected plan type.
  const categoryOptions = React.useMemo(() => {
    const options = localCategories
      .filter((option) => option.is_active && option.plan_type === planType)
      .map((option) => ({ label: option.name, value: option.slug }));

    // An existing plan may sit on a category that was since retired or re-scoped.
    // Keep it selectable so opening the edit dialog doesn't silently move the plan.
    if (category && !options.some((option) => option.value === category)) {
      const known = localCategories.find((option) => option.slug === category);
      options.unshift({ label: known?.name ?? category, value: category });
    }

    return options;
  }, [category, localCategories, planType]);

  function handlePlanTypeChange(nextType: string) {
    setPlanType(nextType);

    const stillValid = localCategories.some(
      (option) => option.slug === category && option.is_active && option.plan_type === nextType,
    );

    if (stillValid) {
      return;
    }

    const firstValid = localCategories.find((option) => option.is_active && option.plan_type === nextType);

    setCategory(firstValid?.slug ?? "");
  }
  const isOfferLike = planType === "offer" || planType === "offer_package";
  const packageServicePlans = availablePlans.filter(
    (candidate) =>
      candidate.id !== plan?.id && candidate.category !== "gym_access" && candidate.type !== "offer_package",
  );
  const isServicePlan =
    selectedCategoryScope !== "gym_access" || planType === "extra_service" || planType === "membership_extra_service";
  const submittedEmployeeRules = isServicePlan ? employeeRules : [];
  const offerDurationDays = calculateInclusiveDays(validFrom, validTo);

  // Freeze days can never exceed the plan's own length — the API enforces
  // `max_freeze_days <= duration_days`, so the inputs are bounded the same way.
  const effectiveDurationDays = resolveDurationDays({
    durationBasis,
    durationDays,
    durationMonths,
    isOfferLike,
    offerDurationDays,
  });
  const maxFreezeDaysNumber = clampDays(maxFreezeDays, effectiveDurationDays);
  const showServiceCommissionEditor = isServicePlan;
  const showServiceCommissionSummary = isServicePlan;
  const showBasePlanCommissionHelp = !isServicePlan;

  // Follow the plan length while untouched. Once the admin has typed a value, keep
  // it — but still pull it down if they shorten the plan, since the API rejects a
  // freeze allowance longer than the plan with a message that never mentions the
  // duration.
  React.useEffect(() => {
    setMaxFreezeDays((current) => {
      if (!maxFreezeTouched) {
        return String(effectiveDurationDays);
      }

      const clamped = clampDays(current, effectiveDurationDays);

      return clamped === Number(current) ? current : String(clamped);
    });
  }, [effectiveDurationDays, maxFreezeTouched]);

  React.useEffect(() => {
    setMinFreezeDays((current) => {
      const clamped = clampDays(current, maxFreezeDaysNumber);

      return clamped === Number(current) ? current : String(clamped);
    });
  }, [maxFreezeDaysNumber]);

  React.useEffect(() => {
    if (!state.message || lastHandledStateRef.current === state) {
      return;
    }

    lastHandledStateRef.current = state;

    if (state.ok) {
      toast.success(t(mode === "edit" ? "planUpdated" : "planCreated"));

      if (mode === "create") {
        onSuccess?.();
        formRef.current?.reset();
        setPlanType("membership");
        setCategory(defaultMembershipCategory);
        setUnlimitedSessions(false);
        setFreezeRequiresApproval(false);
        setDurationBasis("days");
        setDurationMonths("1");
        setValidFrom("");
        setValidTo("");
        // form.reset() only restores uncontrolled inputs, so these need clearing
        // explicitly or the next plan inherits the previous one's freeze rules.
        setDurationDays("30");
        setMinFreezeDays("0");
        // Untouched again, so the next plan re-adopts its own length.
        setMaxFreezeTouched(false);
        setMaxFreezeDays("30");
        setEmployeeRules([]);
        setPlanPrice("0");
        setPackageAddons([]);
      }
    } else {
      toast.error(state.message);
    }
  }, [defaultMembershipCategory, mode, onSuccess, state, t]);

  React.useEffect(() => {
    if (!state.ok) {
      setFreezeRequiresApproval(
        state.values.freeze_requires_approval
          ? state.values.freeze_requires_approval === "on"
          : Boolean(plan?.freeze_requires_approval),
      );
      setPlanType(state.values.type || valueOrPlan(state, plan, "type") || "membership");
      setCategory(state.values.category || valueOrPlan(state, plan, "category") || defaultMembershipCategory);
      setDurationBasis(state.values.duration_basis || (plan?.duration_months ? "months" : "days"));
      setDurationMonths(state.values.duration_months || valueOrPlan(state, plan, "duration_months") || "1");
      setValidFrom(state.values.valid_from || valueOrPlan(state, plan, "valid_from"));
      setValidTo(state.values.valid_to || valueOrPlan(state, plan, "valid_to"));
      const durationDaysValue = state.values.duration_days || valueOrPlan(state, plan, "duration_days") || "30";
      const maxFreezeChosen = Boolean(state.values.max_freeze_days) || mode === "edit";

      setDurationDays(durationDaysValue);
      setMaxFreezeTouched(maxFreezeChosen);
      setMaxFreezeDays(
        maxFreezeChosen
          ? state.values.max_freeze_days || valueOrPlan(state, plan, "max_freeze_days") || "0"
          : durationDaysValue,
      );
      setMinFreezeDays(state.values.min_freeze_days || valueOrPlan(state, plan, "min_freeze_days") || "0");
      setEmployeeRules(readInitialEmployeeRules(state.values.employee_commission_rules, employees, plan?.id));
      setPlanPrice(state.values.price || valueOrPlan(state, plan, "price") || "0");
      setPackageAddons(
        plan?.package_addons?.map((item, index) => ({
          _key: `package-${item.plan_id}-${index}`,
          coach_id: String(item.coach_id),
          plan_id: String(item.plan_id),
        })) ?? [],
      );
    }
  }, [
    employees,
    mode,
    plan,
    plan?.duration_months,
    plan?.freeze_requires_approval,
    plan?.id,
    state,
    state.ok,
    state.values.employee_commission_rules,
    state.values.category,
    defaultMembershipCategory,
    state.values.duration_basis,
    state.values.duration_months,
    state.values.freeze_requires_approval,
    state.values.price,
    state.values.type,
    state.values.valid_from,
    state.values.valid_to,
  ]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      {mode === "edit" && plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <input type="hidden" name="employee_commission_rules" value={JSON.stringify(submittedEmployeeRules)} />
      <input
        type="hidden"
        name="package_addons"
        value={JSON.stringify(
          packageAddons.map(({ coach_id, plan_id }) => ({
            coach_id: Number(resolveCoachIdForPlan(employees, plan_id, coach_id)),
            plan_id: Number(plan_id),
          })),
        )}
      />
      <input
        type="hidden"
        name="initial_employee_commission_rule_ids"
        value={JSON.stringify(initialEmployeeRules.map((rule) => rule.id).filter((id) => id > 0))}
      />
      <Field
        error={fieldError(state, "name")}
        label={t("name")}
        name="name"
        defaultValue={valueOrPlan(state, plan, "name")}
      />

      <div className="space-y-2">
        <Label htmlFor="type">{t("type")}</Label>
        <FormSelect
          id="type"
          name="type"
          value={planType}
          onValueChange={(value) => handlePlanTypeChange(value || "membership")}
          error={fieldError(state, "type")}
          options={[
            { label: t("planTypes.membership"), value: "membership" },
            { label: t("planTypes.offer"), value: "offer" },
            { label: t("planTypes.offerPackage"), value: "offer_package" },
            { label: t("planTypes.fitnessStudio"), value: "fitness_studio" },
            { label: t("planTypes.extraService"), value: "extra_service" },
            { label: t("planTypes.membershipExtraService"), value: "membership_extra_service" },
          ]}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="category">{t("category")}</Label>
          <Dialog
            open={newCatOpen}
            onOpenChange={(open) => {
              setNewCatOpen(open);
              // Preselect the type being edited: that is almost always what the
              // new category is for.
              if (open) {
                setNewCatType(planType as PlanType);
              }
            }}
          >
            <DialogTrigger render={<Button size="xs" variant="ghost" className="h-6 gap-1 text-primary text-xs" />}>
              <Plus className="size-3" /> {t("addCategory")}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("addCategoryTitle")}</DialogTitle>
                <DialogDescription>{t("addCategoryDescription")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label htmlFor="new_cat_name">{t("categoryName")}</Label>
                  <Input
                    id="new_cat_name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder={t("categoryNamePlaceholder")}
                  />
                </div>
                <PlanTypeField id="new_cat_type" onChange={setNewCatType} value={newCatType} />
                <div className="space-y-1">
                  <Label htmlFor="new_cat_desc">{t("categoryDescriptionOptional")}</Label>
                  <Input
                    id="new_cat_desc"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder={t("categoryDescriptionPlaceholder")}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setNewCatOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button type="button" disabled={isCreatingCat} onClick={handleCreateCategory}>
                  {isCreatingCat ? t("saving") : t("saveCategory")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <FormSelect
          id="category"
          name="category"
          value={category}
          onValueChange={(value) => setCategory(value ?? "")}
          error={fieldError(state, "category")}
          options={categoryOptions}
        />
        <p className="text-muted-foreground text-xs">
          {categoryOptions.length === 0 ? t("noCategoriesForType") : t("categoryForTypeHelp")}
        </p>
      </div>

      <Field
        error={fieldError(state, "price")}
        help={t("basePriceHelp")}
        label={t("basePrice")}
        name="price"
        type="number"
        step="0.01"
        value={planPrice}
        onChange={(event) => setPlanPrice(event.currentTarget.value)}
      />
      {isOfferLike ? (
        <>
          <input type="hidden" name="duration_basis" value="days" />
          <input type="hidden" name="duration_months" value="" />
          <input type="hidden" name="duration_days" value={offerDurationDays} />
          <DateField
            error={fieldError(state, "valid_from")}
            label={t("validFrom")}
            name="valid_from"
            onValueChange={setValidFrom}
            placeholder={t("selectDate")}
            defaultValue={validFrom}
          />
          <DateField
            error={fieldError(state, "valid_to")}
            label={t("validTo")}
            name="valid_to"
            onValueChange={setValidTo}
            placeholder={t("selectDate")}
            defaultValue={validTo}
          />
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="duration_basis">{t("durationType")}</Label>
          <FormSelect
            id="duration_basis"
            name="duration_basis"
            defaultValue={durationBasis}
            onValueChange={(value) => setDurationBasis(value)}
            error={fieldError(state, "duration_basis")}
            options={[
              { value: "days", label: t("durationTypeDays") },
              { value: "months", label: t("durationTypeMonths") },
            ]}
          />
        </div>
      )}
      {planType !== "offer" && planType !== "offer_package" && durationBasis === "months" ? (
        <>
          <input type="hidden" name="valid_from" value="" />
          <input type="hidden" name="valid_to" value="" />
          <input type="hidden" name="duration_days" value={Math.max(1, Number(durationMonths || 1) * 30)} />
          <Field
            error={fieldError(state, "duration_months")}
            help={t("durationMonthsHelp")}
            label={t("durationMonths")}
            name="duration_months"
            onChange={(event) => setDurationMonths(event.currentTarget.value)}
            type="number"
            defaultValue={durationMonths}
          />
        </>
      ) : null}
      {planType !== "offer" && planType !== "offer_package" && durationBasis === "days" ? (
        <>
          <input type="hidden" name="valid_from" value="" />
          <input type="hidden" name="valid_to" value="" />
          <input type="hidden" name="duration_months" value="" />
          <Field
            error={fieldError(state, "duration_days")}
            label={t("durationDays")}
            min="1"
            name="duration_days"
            onChange={(event) => setDurationDays(event.currentTarget.value)}
            type="number"
            defaultValue={durationDays}
          />
        </>
      ) : null}

      {planType === "offer_package" || planType === "membership_extra_service" ? (
        <div className="grid gap-3 rounded-lg border border-dashed p-4">
          <div>
            <Label>Included extra services</Label>
            <p className="text-muted-foreground text-xs">
              These add-ons are created automatically when this combined plan is sold. Their cost is included in the
              plan price.
            </p>
          </div>
          {packageAddons.map((item, index) => {
            const assignedCoaches = coachesAssignedToPlan(employees, item.plan_id);
            const coachOptions = assignedCoaches.map((employee) => ({
              label: employee.role ? `${employee.name} - ${employee.role}` : employee.name,
              value: String(employee.id),
            }));
            const coachValue = coachOptions.some((option) => option.value === item.coach_id)
              ? item.coach_id
              : (coachOptions[0]?.value ?? "");

            return (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" key={item._key}>
                <FormSelect
                  name={`package_addon_plan_${index}`}
                  value={item.plan_id}
                  onValueChange={(value) =>
                    setPackageAddons((items) =>
                      items.map((current) =>
                        current._key === item._key
                          ? {
                              ...current,
                              coach_id: defaultCoachIdForPlan(employees, value),
                              plan_id: value,
                            }
                          : current,
                      ),
                    )
                  }
                  options={packageServicePlans.map((candidate) => ({
                    label: `${candidate.name} - ${candidate.price} EGP`,
                    value: String(candidate.id),
                  }))}
                  placeholder="Select extra service"
                />
                <div className="grid gap-1">
                  <FormSelect
                    name={`package_addon_coach_${index}`}
                    value={coachValue}
                    onValueChange={(value) =>
                      setPackageAddons((items) =>
                        items.map((current) =>
                          current._key === item._key ? { ...current, coach_id: value } : current,
                        ),
                      )
                    }
                    options={coachOptions}
                    placeholder={coachOptions.length === 0 ? "No coaches assigned to this service" : "Select coach"}
                    disabled={coachOptions.length === 0}
                  />
                  {coachOptions.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Add a commission rule for this service on the coach first.
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPackageAddons((items) => items.filter((current) => current._key !== item._key))}
                >
                  Remove
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            disabled={packageServicePlans.length === 0}
            onClick={() => {
              const planId = packageServicePlans[0] ? String(packageServicePlans[0].id) : "";

              setPackageAddons((items) => [
                ...items,
                {
                  _key: `package-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
                  coach_id: defaultCoachIdForPlan(employees, planId),
                  plan_id: planId,
                },
              ]);
            }}
          >
            Add included service
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input type="hidden" name="is_unlimited_sessions" value={unlimitedSessions ? "on" : ""} />
        <Checkbox
          id="is_unlimited_sessions"
          checked={unlimitedSessions}
          onCheckedChange={(checked) => setUnlimitedSessions(checked === true)}
        />
        <Label htmlFor="is_unlimited_sessions">{t("unlimitedSessions")}</Label>
      </div>

      {!unlimitedSessions ? (
        <div className="space-y-1">
          <Field
            error={fieldError(state, "sessions_count")}
            label={t("sessionsCount")}
            name="sessions_count"
            type="number"
            defaultValue={valueOrPlan(state, plan, "sessions_count")}
          />
          <p className="text-muted-foreground text-xs">{t("sessionsCountHelp")}</p>
        </div>
      ) : null}

      <Field
        error={fieldError(state, "max_freeze_days")}
        help={t("maxFreezeDaysRange", { max: effectiveDurationDays })}
        label={t("maxFreezeDays")}
        max={String(effectiveDurationDays)}
        min="0"
        name="max_freeze_days"
        onChange={(event) => {
          setMaxFreezeTouched(true);
          setMaxFreezeDays(event.currentTarget.value);
        }}
        type="number"
        value={maxFreezeDays}
      />
      <Field
        error={fieldError(state, "min_freeze_days")}
        help={t("minFreezeDaysRange", { max: maxFreezeDaysNumber })}
        label={t("minFreezeDays")}
        max={String(maxFreezeDaysNumber)}
        min="0"
        name="min_freeze_days"
        onChange={(event) => setMinFreezeDays(event.currentTarget.value)}
        type="number"
        value={minFreezeDays}
      />
      <Field
        error={fieldError(state, "access_grace_days")}
        label={t("accessGraceDays")}
        min="0"
        name="access_grace_days"
        type="number"
        defaultValue={valueOrPlan(state, plan, "access_grace_days") || "0"}
      />
      <Field
        error={fieldError(state, "cancellation_grace_days")}
        label={t("cancellationGraceDays")}
        min="0"
        name="cancellation_grace_days"
        type="number"
        defaultValue={valueOrPlan(state, plan, "cancellation_grace_days") || "2"}
      />
      <p className="text-muted-foreground text-xs">{t("cancellationGraceDaysHelp")}</p>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input type="hidden" name="freeze_requires_approval" value={freezeRequiresApproval ? "on" : ""} />
          <Checkbox
            id="freeze_requires_approval"
            checked={freezeRequiresApproval}
            onCheckedChange={(checked) => setFreezeRequiresApproval(checked === true)}
          />
          <Label htmlFor="freeze_requires_approval">{t("freezeRequiresApproval")}</Label>
        </div>
        <p className="text-muted-foreground text-xs">{t("freezeRequiresApprovalHelp")}</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input type="hidden" name="restrict_access_hours" value={restrictAccessHours ? "on" : ""} />
          <Checkbox
            id="restrict_access_hours"
            checked={restrictAccessHours}
            onCheckedChange={(checked) => setRestrictAccessHours(checked === true)}
          />
          <Label htmlFor="restrict_access_hours">{t("restrictAccessHours")}</Label>
        </div>
        <p className="text-muted-foreground text-xs">{t("restrictAccessHoursHelp")}</p>
      </div>

      {restrictAccessHours ? (
        <>
          <TimeField
            error={fieldError(state, "access_starts_at")}
            label={t("accessStartsAt")}
            name="access_starts_at"
            defaultValue={initialAccessStartsAt}
          />
          <TimeField
            error={fieldError(state, "access_ends_at")}
            label={t("accessEndsAt")}
            name="access_ends_at"
            defaultValue={initialAccessEndsAt}
          />
          <p className="text-muted-foreground text-xs">{t("accessHoursHelp")}</p>
        </>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="description">{t("descriptionField")}</Label>
        <Textarea id="description" name="description" defaultValue={valueOrPlan(state, plan, "description")} />
      </div>

      {showServiceCommissionEditor ? (
        <PlanEmployeesSection
          employees={employees}
          rules={employeeRules}
          setRules={setEmployeeRules}
          title={t("serviceCoaches")}
          description={t("serviceCoachesDescription")}
          addLabel={t("addServiceCoach")}
          employeeLabel={t("employee")}
          commissionTypeLabel={t("commissionType")}
          commissionValueLabel={t("commissionValue")}
          planPrice={planPriceNumber}
          earnsLabel={(amount) => t("coachEarnsPerSale", { amount: formatMoney(amount.toFixed(2)) })}
          fixedLabel={t("fixedCommission")}
          percentLabel={t("percentageCommission")}
          activeLabel={t("active")}
          deleteLabel={t("delete")}
        />
      ) : null}
      {showBasePlanCommissionHelp ? (
        <div className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
          {t("basePlanCommissionHelp")}
        </div>
      ) : null}

      <div className="grid gap-2 rounded-lg border bg-muted/20 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("summaryMemberPays")}</span>
          <span className="font-medium tabular-nums">{formatMoney(planPrice)}</span>
        </div>
        {showServiceCommissionSummary ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("summaryCoachCommission")}</span>
              <span className="font-medium tabular-nums">
                {coachCommissionVaries
                  ? formatMoneyRange(lowestCoachCommission, highestCoachCommission)
                  : formatMoney(highestCoachCommission.toFixed(2))}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-2">
              <span className="font-medium">{t("summaryGymNet")}</span>
              <span className="font-semibold tabular-nums">
                {coachCommissionVaries
                  ? formatMoneyRange(gymNetBeforeExpenses, gymNetBestCase)
                  : formatMoney(gymNetBeforeExpenses.toFixed(2))}
              </span>
            </div>
            {coachCommissionAmounts.length > 1 ? (
              <p className="text-muted-foreground text-xs">{t("summaryCoachCommissionHint")}</p>
            ) : null}
          </>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        <PackageCheck />
        {pending ? t("saving") : t(mode === "edit" ? "savePlan" : "createPlan")}
      </Button>
    </form>
  );
}

function calculateInclusiveDays(start: string, end: string): number {
  if (!start || !end) {
    return 1;
  }

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const diffMs = endDate.getTime() - startDate.getTime();

  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return 1;
  }

  return Math.max(1, Math.floor(diffMs / 86_400_000) + 1);
}

function valueOrPlan(state: PlanFormState, plan: PlanRow | undefined, key: keyof PlanRow): string {
  const stateValue = state.values[String(key)];

  if (stateValue !== undefined) {
    return stateValue;
  }

  const planValue = plan?.[key];

  if (planValue === null || planValue === undefined) {
    return "";
  }

  return String(planValue);
}

function fieldError(state: PlanFormState, name: string) {
  return state.errors[name]?.[0];
}

function formatMoney(value: string) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "EGP 0.00";
  }

  return `EGP ${number.toFixed(2)}`;
}

/** What a single coach earns on one sale of this plan. */
function commissionAmount(rule: PlanEmployeeCommissionDraft, planPrice: number) {
  const value = Math.max(0, Number(rule.value || 0));

  return rule.calculation_type === "percentage" ? planPrice * (Math.min(value, 100) / 100) : value;
}

function formatMoneyRange(from: number, to: number) {
  return `${formatMoney(from.toFixed(2))} – ${formatMoney(to.toFixed(2))}`;
}

function Field({
  defaultValue = "",
  error,
  help,
  label,
  max,
  min,
  name,
  onChange,
  step,
  type = "text",
  value,
}: {
  defaultValue?: string;
  error?: string;
  help?: string;
  label: string;
  max?: string;
  min?: string;
  name: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  step?: string;
  type?: string;
  /** Pass to make the field controlled; otherwise it falls back to defaultValue. */
  value?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        min={min}
        max={max}
        {...(value === undefined ? { defaultValue } : { value })}
        aria-invalid={Boolean(error)}
        onChange={onChange}
      />
      {help ? <p className="text-muted-foreground text-xs">{help}</p> : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

/**
 * How long the plan actually runs. Which input carries that depends on the plan
 * type: offers derive it from their validity window, and a months-based duration
 * is submitted as months × 30.
 */
function resolveDurationDays({
  durationBasis,
  durationDays,
  durationMonths,
  isOfferLike,
  offerDurationDays,
}: {
  durationBasis: string;
  durationDays: string;
  durationMonths: string;
  isOfferLike: boolean;
  offerDurationDays: number;
}): number {
  if (isOfferLike) {
    return offerDurationDays;
  }

  if (durationBasis === "months") {
    return Math.max(1, Number(durationMonths || 1) * 30);
  }

  return Math.max(1, Number(durationDays || 1));
}

/** Whole days within 0…limit; anything unparseable reads as 0. */
function clampDays(value: string, limit: number): number {
  const parsed = Math.floor(Number(value));

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(parsed, Math.max(0, limit));
}

/**
 * What the hour pickers show once the admin asks for an access window. A plan that
 * already has one keeps it; anything else starts at 09:00–23:59 so the usual case
 * needs no typing. An empty window is never submitted from here — the checkbox
 * decides whether these values reach the server at all.
 */
function accessWindowDefault(
  state: PlanFormState,
  plan: PlanRow | undefined,
  mode: "create" | "edit",
  key: "access_starts_at" | "access_ends_at",
): string {
  const submitted = state.values[key];

  if (submitted) {
    return submitted;
  }

  const saved = mode === "edit" ? valueOrPlan(state, plan, key) : "";

  if (saved) {
    return saved;
  }

  return key === "access_starts_at" ? DEFAULT_ACCESS_STARTS_AT : DEFAULT_ACCESS_ENDS_AT;
}

function DateField({
  defaultValue,
  error,
  label,
  name,
  onValueChange,
  placeholder,
}: {
  defaultValue?: string;
  error?: string;
  label: string;
  name: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <FormDatePicker
        id={name}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        error={error}
      />
    </div>
  );
}

function TimeField({
  defaultValue,
  error,
  label,
  name,
}: {
  defaultValue?: string;
  error?: string;
  label: string;
  name: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <FormTimePicker id={name} name={name} defaultValue={defaultValue} error={error} />
    </div>
  );
}

/** Coaches/captains with an active commission rule on the included service plan. */
function coachesAssignedToPlan(employees: PlanEmployeeOption[], planId: string): PlanEmployeeOption[] {
  const id = Number(planId);

  if (!Number.isFinite(id) || id <= 0) {
    return [];
  }

  return employees.filter((employee) =>
    (employee.plan_commission_rules ?? []).some((rule) => rule.is_active && rule.plan_id === id),
  );
}

function defaultCoachIdForPlan(employees: PlanEmployeeOption[], planId: string): string {
  const [first] = coachesAssignedToPlan(employees, planId);

  return first ? String(first.id) : "";
}

function resolveCoachIdForPlan(employees: PlanEmployeeOption[], planId: string, coachId: string): string {
  const assigned = coachesAssignedToPlan(employees, planId);

  if (assigned.some((employee) => String(employee.id) === coachId)) {
    return coachId;
  }

  return assigned[0] ? String(assigned[0].id) : "";
}

function readInitialEmployeeRules(
  stateValue: string | undefined,
  employees: PlanEmployeeOption[],
  planId?: number,
): PlanEmployeeCommissionDraft[] {
  if (stateValue) {
    try {
      const parsed = JSON.parse(stateValue) as unknown;

      return Array.isArray(parsed)
        ? parsed
            .map((rule, index) => normalizeEmployeeRule(rule, index))
            .filter((rule): rule is PlanEmployeeCommissionDraft => rule !== null)
        : [];
    } catch {
      return [];
    }
  }

  if (!planId) {
    return [];
  }

  return employees.flatMap((employee) =>
    (employee.plan_commission_rules ?? [])
      .filter((rule) => rule.plan_id === planId)
      .map((rule) => ({
        _key: `existing-${rule.id}`,
        calculation_type: rule.calculation_type,
        employee_id: String(employee.id),
        id: rule.id,
        is_active: rule.is_active,
        value: rule.value,
      })),
  );
}

function PlanEmployeesSection({
  activeLabel,
  addLabel,
  commissionTypeLabel,
  commissionValueLabel,
  deleteLabel,
  description,
  earnsLabel,
  employeeLabel,
  employees,
  fixedLabel,
  percentLabel,
  planPrice,
  rules,
  setRules,
  title,
}: {
  activeLabel: string;
  addLabel: string;
  commissionTypeLabel: string;
  commissionValueLabel: string;
  deleteLabel: string;
  description: string;
  earnsLabel: (amount: number) => string;
  employeeLabel: string;
  employees: PlanEmployeeOption[];
  fixedLabel: string;
  percentLabel: string;
  planPrice: number;
  rules: PlanEmployeeCommissionDraft[];
  setRules: React.Dispatch<React.SetStateAction<PlanEmployeeCommissionDraft[]>>;
  title: string;
}) {
  const employeeOptions = React.useMemo(() => {
    const coachCandidates = employees.filter((employee) => {
      if (!employee.role) {
        return true;
      }
      const r = employee.role.toLowerCase();
      return r.includes("coach") || r.includes("captain") || r.includes("trainer") || r.includes("pt");
    });

    const baseOptions = (coachCandidates.length > 0 ? coachCandidates : employees).map((employee) => ({
      value: String(employee.id),
      label: employee.role ? `${employee.name} - ${employee.role}` : employee.name,
    }));

    const employeesById = new Map(employees.map((employee) => [String(employee.id), employee]));
    const knownValues = new Set(baseOptions.map((option) => option.value));
    const missingOptions = rules
      .map((rule) => rule.employee_id)
      .filter((employeeId) => employeeId && !knownValues.has(employeeId))
      .map((employeeId) => {
        const employee = employeesById.get(employeeId);
        let label = `Employee #${employeeId}`;

        if (employee) {
          label = employee.role ? `${employee.name} - ${employee.role}` : employee.name;
        }

        return {
          value: employeeId,
          label,
        };
      });

    return [...baseOptions, ...missingOptions];
  }, [employees, rules]);

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-4">
      <div className="space-y-1">
        <Label>{title}</Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>

      {rules.map((rule, index) => (
        <div key={rule._key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 sm:col-span-2 xl:col-span-1">
            <Label>{employeeLabel}</Label>
            <FormSelect
              name={`employee_rules.${index}.employee_id`}
              value={rule.employee_id}
              className="min-w-0"
              contentClassName="w-[24rem] max-w-[calc(100vw-2rem)]"
              onValueChange={(value) =>
                setRules((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, employee_id: value ?? "" } : item,
                  ),
                )
              }
              options={employeeOptions}
            />
          </div>

          <div className="space-y-2">
            <Label>{commissionTypeLabel}</Label>
            <FormSelect
              name={`employee_rules.${index}.calculation_type`}
              value={rule.calculation_type}
              className="min-w-0"
              contentClassName="max-w-[calc(100vw-2rem)]"
              onValueChange={(value) =>
                setRules((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, calculation_type: (value as "fixed" | "percentage") ?? "fixed" }
                      : item,
                  ),
                )
              }
              options={[
                { value: "fixed", label: fixedLabel },
                { value: "percentage", label: percentLabel },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>{commissionValueLabel}</Label>
            <Input
              name={`employee_rules.${index}.value`}
              type="number"
              min="0"
              step="0.01"
              value={rule.value}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;

                setRules((current) =>
                  current.map((item, itemIndex) => (itemIndex === index ? { ...item, value: nextValue } : item)),
                );
              }}
            />
            {rule.is_active ? (
              <p className="text-muted-foreground text-xs">{earnsLabel(commissionAmount(rule, planPrice))}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-1">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-2">
              <Checkbox
                checked={rule.is_active}
                onCheckedChange={(checked) =>
                  setRules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, is_active: checked === true } : item,
                    ),
                  )
                }
              />
              <span className="text-sm">{activeLabel}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => setRules((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            >
              {deleteLabel}
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setRules((current) => [
            ...current,
            {
              _key: `new-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`,
              calculation_type: "fixed",
              employee_id: employees[0] ? String(employees[0].id) : "",
              id: 0,
              is_active: true,
              value: "0",
            },
          ])
        }
      >
        {addLabel}
      </Button>
    </div>
  );
}
