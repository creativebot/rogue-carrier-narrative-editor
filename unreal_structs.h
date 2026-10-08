// Rogue Carrier - Narrative Editor Toolkit
// Unreal Engine 5 C++ Data Table Structures (Drop into Source/RogueCarrier/Narrative/)

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "RCNarrativeStructures.generated.h"

// Action Requirement Alternative Item Struct
USTRUCT(BlueprintType)
struct FRCRequirementAlternative
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Requirement")
    FString ItemID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Requirement")
    FString ItemName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Requirement")
    int32 Amount = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Requirement")
    FString Category; // "Item", "Building", "Stat", "Specialization"

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Requirement")
    FString Icon;
};

// Action Requirement Clause Struct (AND across clauses, OR across alternative items)
USTRUCT(BlueprintType)
struct FRCRequirementClause
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Requirement")
    FString ClauseID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Requirement")
    bool bIsAlternativeGroup = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Requirement")
    TArray<FRCRequirementAlternative> Alternatives;
};

// Structured Action Reward Item
USTRUCT(BlueprintType)
struct FRCRewardItem
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Reward")
    FString ResourceID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Reward")
    FString Name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Reward")
    FString Amount; // Supports single numbers ("10") and drop ranges ("20-30", "+1-2")

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Reward")
    FString Category; // "Item", "Building", "Stat", "Specialization"

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Reward")
    FString Icon;
};

// Action Choice Struct
USTRUCT(BlueprintType)
struct FRCActionChoice
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    FString ActionID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    int32 ActionIndex = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    FString CodeSuffix; // "A1", "B1", "C1"...

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    FString ShortDescription;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    FString Description;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    float TimerHours = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    TArray<FRCRequirementClause> RequirementClauses;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    FString ResultDescription;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    TArray<FString> Rewards; // Formatted display strings (e.g. "🔬 Science Spec +1-2", "Scrap 20-30")

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    TArray<FRCRewardItem> StructuredRewards; // Typed reward objects for inventory/stat logic

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Action")
    FString TargetNodeID;
};

// Structured Inaction Penalty Item
USTRUCT(BlueprintType)
struct FRCInactionPenaltyItem
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    FString ResourceID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    FString Name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    FString Amount;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    FString Category;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    FString Icon;
};

// Inaction Threat Struct
USTRUCT(BlueprintType)
struct FRCInactionThreat
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    bool bHasInactionThreat = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    FString Description;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    FString ShortDescription;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    bool bIsTimerInfinite = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    float TimerHours = -1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    FString ResultDescription;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    TArray<FString> Penalties; // Formatted display strings (e.g. "💀 Entropy +10")

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    TArray<FRCInactionPenaltyItem> StructuredPenalties; // Typed penalty objects

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Inaction")
    FString TargetFailureNodeID;
};

// Event Row for Unreal Engine DataTable (FRCEventTableRow)
USTRUCT(BlueprintType)
struct FRCEventTableRow : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString EventID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString Codename;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString EventTitle; // Display title of the event

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString EventType; // "World" or "Deck"

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString Category; // "KeyChain", "GenericPool", "DeckPool", "SecretChain"

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString VariationID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    int32 FloorIndex = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString Tier; // "Tier I", "Tier II", "Tier III", "Tier IV", "Tier V"

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString Location;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString SpawnConditions;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString ColorScheme;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FVector2D EditorPosition;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString EventIntro;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FString EventDescription;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    bool bIsReactionTimerInfinite = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    float ReactionTimerHours = -1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    TArray<FRCActionChoice> Actions;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    bool bHasInactionThreat = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Event")
    FRCInactionThreat InactionThreat;
};

// Dialogue Turn Struct
USTRUCT(BlueprintType)
struct FRCDialogueLine
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString LineID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString SpeakerID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString SpeakerName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString Text;
};

// Dialogue Row for Unreal Engine DataTable (FRCDialogueTableRow)
USTRUCT(BlueprintType)
struct FRCDialogueTableRow : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString DialogueID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString TargetEventID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString TriggerTiming; // "pre_event" or "post_action"

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString TriggerActionID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString TriggerCondition;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    float DelayHours = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString DelayUnit; // "hours" or "minutes"

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString VariationID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString Category;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    int32 FloorIndex = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FString ColorScheme;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    FVector2D EditorPosition;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Dialogue")
    TArray<FRCDialogueLine> Lines;
};

// Character Row for Unreal Engine DataTable (FRCCharacterTableRow)
USTRUCT(BlueprintType)
struct FRCCharacterTableRow : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Character")
    FString CharacterID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Character")
    FString CharacterName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Character")
    FString Role;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Character")
    FString Color;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Character")
    FString TextColor;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Character")
    FString Icon;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Character")
    TArray<FString> VariationIDs;
};

// Timeline Row for Unreal Engine DataTable (FRCTimelineTableRow)
USTRUCT(BlueprintType)
struct FRCTimelineTableRow : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Timeline")
    FString TimelineID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Timeline")
    int32 TimelineNumber = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Timeline")
    FString Name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Timeline")
    FString Description;
};

// Variation Row for Unreal Engine DataTable (FRCVariationTableRow)
USTRUCT(BlueprintType)
struct FRCVariationTableRow : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Variation")
    FString VariationID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Variation")
    FString TimelineID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Variation")
    int32 VariationNumber = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Variation")
    FString Name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Narrative|Variation")
    FString Description;
};
