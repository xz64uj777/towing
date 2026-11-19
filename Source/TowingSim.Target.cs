using UnrealBuildTool;
using System.Collections.Generic;

public class TowingSimTarget : TargetRules
{
    public TowingSimTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
        ExtraModuleNames.Add("TowingSim");
    }
}
